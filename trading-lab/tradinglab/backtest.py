"""Walk-forward backtest + laporan dengan vonis otomatis yang konservatif."""

import math
from dataclasses import replace
from typing import Dict, List

from .config import Config
from .data import Bar, count_gaps
from .engine import Engine, forward_return
from .metrics import brier_skill, performance, reliability
from .regime import REGIMES

MIN_TRADES = 30
MIN_T_STAT = 2.0


def run(bars: List[Bar], cfg: Config) -> Engine:
    eng = Engine(cfg, trading=True)
    for b in bars:
        eng.on_bar(b)
    return eng


def evaluate(bars: List[Bar], cfg: Config) -> Dict:
    eng = run(bars, cfg)
    start = next((d["i"] for d in eng.decisions if d["p"] is not None), None)
    if start is None:
        raise ValueError("Data terlalu pendek: model tidak pernah aktif. "
                         f"Butuh > {cfg.min_train} bar setelah warmup.")
    equity = [e for _, e, _ in eng.equity_curve[start:]]
    exposure = [x for _, _, x in eng.equity_curve[start:]]
    bh = [cfg.initial_equity * b.close / bars[start].close for b in bars[start:]]

    pairs = []
    for d in eng.decisions[start:]:
        r = forward_return(bars, d["i"], cfg.horizon)
        if d["p"] is not None and r is not None:
            pairs.append((d["p"], 1 if r > 0 else 0))

    by_regime = {k: {"bars": 0, "strat": 0.0, "market": 0.0} for k in REGIMES}
    for k in range(start + 1, len(bars)):
        reg = eng.decisions[k - 1]["regime"]
        if reg is None:
            continue
        e0, e1 = eng.equity_curve[k - 1][1], eng.equity_curve[k][1]
        by_regime[reg]["bars"] += 1
        by_regime[reg]["strat"] += math.log(e1 / e0)
        by_regime[reg]["market"] += math.log(bars[k].close / bars[k - 1].close)

    stress_cfg = replace(cfg, fee_bps=cfg.fee_bps * 2, slippage_bps=cfg.slippage_bps * 2)
    stress = run(bars, stress_cfg)
    stress_equity = [e for _, e, _ in stress.equity_curve[start:]]

    halted = [d for d in eng.decisions if d["risk_state"] == "halt"]
    return {
        "cfg": cfg,
        "period": (bars[start].ts, bars[-1].ts),
        "n_bars_total": len(bars),
        "gaps": count_gaps(bars, cfg.bar_seconds),
        "strategy": performance(equity, cfg.bars_per_year),
        "buy_hold": performance(bh, cfg.bars_per_year),
        "stress_2x_cost": performance(stress_equity, cfg.bars_per_year),
        "stress_trades": len(stress.portfolio.trades),
        "calibration": brier_skill(pairs) if pairs else None,
        "reliability": reliability(pairs) if pairs else [],
        "trades": len(eng.portfolio.trades),
        "fees": eng.portfolio.fees_paid,
        "slippage": eng.portfolio.slippage_paid,
        "avg_exposure": sum(exposure) / len(exposure),
        "by_regime": by_regime,
        "halted_at": halted[0]["ts"] if halted else None,
        "halt_reason": eng.risk.halt_reason,
        "engine": eng,
    }


def verdict(res: Dict) -> List[str]:
    """Daftar alasan GAGAL. Kosong = lolos syarat minimum (bukan jaminan profit)."""
    fails = []
    cal = res["calibration"]
    if cal is None or cal["bss"] <= 0:
        fails.append("Brier skill score <= 0: probabilitas model tidak lebih baik dari base rate.")
    if res["trades"] < MIN_TRADES:
        fails.append(f"Hanya {res['trades']} trade (< {MIN_TRADES}): sampel terlalu kecil.")
    if res["strategy"].get("t_stat", 0) < MIN_T_STAT:
        fails.append(f"t-stat return {res['strategy'].get('t_stat', 0):.2f} < {MIN_T_STAT}: "
                     "tidak bisa dibedakan dari nol.")
    if res["stress_trades"] == 0:
        fails.append("Nol trade saat biaya 2x: edge yang diprediksi selalu di bawah biaya.")
    elif res["stress_2x_cost"].get("sharpe", 0) <= 0:
        fails.append("Sharpe <= 0 saat biaya 2x: edge tidak tahan biaya/slippage.")
    if res["halted_at"] is not None:
        fails.append(f"Risk layer melakukan halt: {res['halt_reason']}.")
    return fails


def _pct(x): return f"{x:+.2%}" if isinstance(x, float) and not math.isnan(x) else "n/a"
def _num(x): return f"{x:.2f}" if isinstance(x, float) else str(x)
def _dd(x): return f"{x:.2%}" if isinstance(x, float) else "n/a"


def report_markdown(res: Dict, title: str = "Laporan Backtest") -> str:
    from datetime import datetime, timezone

    def iso(ts): return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    s, bh, st = res["strategy"], res["buy_hold"], res["stress_2x_cost"]
    cfg = res["cfg"]
    lines = [
        f"# {title}", "",
        f"- Periode evaluasi (out-of-sample, walk-forward): {iso(res['period'][0])} → {iso(res['period'][1])}",
        f"- Total bar: {res['n_bars_total']} · bar hilang (gap): {res['gaps']}",
        f"- Biaya: fee {cfg.fee_bps} bps + slippage {cfg.slippage_bps} bps per sisi "
        f"(round-trip {cfg.round_trip_cost:.2%})",
        f"- Refit tiap {cfg.refit_every} bar, jendela training {cfg.train_window} bar, "
        f"gate p ≥ {cfg.p_min}, {cfg.kelly_fraction:g}× Kelly, posisi maks {cfg.max_position:g}",
        "",
        "## Performa", "",
        "| Metrik | Strategi | Buy & hold | Strategi, biaya 2× |",
        "|---|---:|---:|---:|",
    ]
    for key, label, fmt in [("total_return", "Total return", _pct), ("cagr", "CAGR", _pct),
                            ("sharpe", "Sharpe (tahunan)", _num), ("t_stat", "t-stat", _num),
                            ("max_drawdown", "Max drawdown", _dd)]:
        lines.append(f"| {label} | {fmt(s.get(key))} | {fmt(bh.get(key))} | {fmt(st.get(key))} |")
    lines += [
        "",
        f"Trade: {res['trades']} · fee dibayar: {res['fees']:.2f} · slippage: {res['slippage']:.2f} "
        f"· rata-rata eksposur: {res['avg_exposure']:.1%} · trade saat biaya 2×: {res['stress_trades']}",
        "",
        "## Kalibrasi (out-of-sample)", "",
    ]
    cal = res["calibration"]
    if cal:
        lines += [
            f"- n = {cal['n']}, base rate naik = {cal['base_rate']:.3f}",
            f"- Brier model = {cal['brier']:.5f} · Brier base rate = {cal['brier_base']:.5f} "
            f"· **Brier skill score = {cal['bss']:+.4f}**",
            "", "| Bin p | n | rata-rata p | frekuensi naik |", "|---|---:|---:|---:|",
        ]
        for r in res["reliability"]:
            lines.append(f"| {r['lo']:.1f}–{r['hi']:.1f} | {r['n']} | {r['mean_p']:.3f} | {r['freq']:.3f} |")
    lines += ["", "## Per rezim (log return dijumlah)", "",
              "| Rezim | Bar | Strategi | Pasar |", "|---|---:|---:|---:|"]
    for k, v in res["by_regime"].items():
        lines.append(f"| {k} | {v['bars']} | {v['strat']:+.4f} | {v['market']:+.4f} |")

    fails = verdict(res)
    lines += ["", "## Vonis", ""]
    if fails:
        lines.append("**TIDAK ADA BUKTI EDGE. Jangan lanjut ke uang riil.**")
        lines += [""] + [f"- {f}" for f in fails]
    else:
        lines.append("Lolos syarat minimum. Ini BUKAN bukti profit: lanjutkan ke paper trading "
                     "minimal beberapa minggu dan bandingkan hasilnya dengan backtest ini.")
    lines += ["", "_Catatan: t-stat mengabaikan autokorelasi; drawdown diukur di close, "
              "gap intrabar bisa melampaui batas 15%._", ""]
    return "\n".join(lines)
