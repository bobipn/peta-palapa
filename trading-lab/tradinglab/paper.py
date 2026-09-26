"""Paper trading: engine yang sama dengan backtest, diberi bar live yang sudah tutup.

Tidak ada kode yang mengirim order ke exchange. Fill disimulasikan pada open
bar berikutnya, persis seperti di backtest.
"""

import json
import math
import os
import time
from typing import Optional

from .config import Config
from .data import fetch_recent
from .engine import Engine
from .features import WARMUP
from .metrics import brier_skill, performance


def _atomic_write_json(path: str, obj) -> None:
    tmp = path + ".tmp"
    with open(tmp, "w") as fh:
        json.dump(obj, fh, indent=2)
    os.replace(tmp, path)


class PaperRunner:
    def __init__(self, product: str, cfg: Config, state_dir: str, quiet: bool = False):
        self.product = product
        self.quiet = quiet
        self.cfg = cfg
        self.state_dir = state_dir
        self.state_path = os.path.join(state_dir, "state.json")
        self.journal_path = os.path.join(state_dir, "journal.jsonl")
        os.makedirs(state_dir, exist_ok=True)
        self.engine = Engine(cfg, trading=False)

    def bootstrap(self, history) -> list:
        """Replay histori tanpa trading, pulihkan state, kembalikan bar yang belum diproses."""
        state = None
        if os.path.exists(self.state_path):
            with open(self.state_path) as fh:
                state = json.load(fh)
            if state.get("product") != self.product:
                raise ValueError(f"state.json milik {state.get('product')}, bukan {self.product}")
        if state:
            replay = [b for b in history if b.ts <= state["last_ts"]]
            live = [b for b in history if b.ts > state["last_ts"]]
        else:
            replay, live = history[:-1], history[-1:]
        for b in replay:
            self.engine.on_bar(b)
        if state:
            self.engine.portfolio.load_dict(state["portfolio"])
            self.engine.risk.load_dict(state["risk"])
            self.engine.pending = state["pending"]
        self.engine.trading = True
        return live

    def step(self, bar) -> dict:
        d = self.engine.on_bar(bar)
        row = {"ts": bar.ts, "open": bar.open, "close": bar.close,
               **{k: d[k] for k in ("p", "regime", "raw", "target", "risk_state", "reason",
                                    "trade", "equity")}}
        with open(self.journal_path, "a") as fh:
            fh.write(json.dumps(row) + "\n")
        _atomic_write_json(self.state_path, {
            "product": self.product, "last_ts": bar.ts, "pending": self.engine.pending,
            "portfolio": self.engine.portfolio.to_dict(), "risk": self.engine.risk.to_dict(),
        })
        if self.quiet:
            return d
        p = "  -  " if d["p"] is None else f"{d['p']:.3f}"
        print(f"[paper] {bar.ts} close={bar.close:.2f} p={p} rezim={d['regime']} "
              f"target={d['target']:.2f} risk={d['risk_state']} ekuitas={d['equity']:.2f} "
              f"({d['reason']}){' TRADE' if d['trade'] else ''}")
        return d

    def last_ts(self) -> Optional[int]:
        return self.engine.bars[-1].ts if self.engine.bars else None


def run_paper(product: str, cfg: Config, state_dir: str, poll_seconds: int = 60,
              once: bool = False) -> None:
    runner = PaperRunner(product, cfg, state_dir)
    n = cfg.train_window + WARMUP + cfg.horizon + 50
    print(f"[paper] mengambil {n} bar histori {product} ...")
    for bar in runner.bootstrap(fetch_recent(product, cfg.bar_seconds, n)):
        runner.step(bar)
    if once:
        return
    while True:
        time.sleep(poll_seconds)
        try:
            recent = fetch_recent(product, cfg.bar_seconds, 6)
        except Exception as exc:   # jaringan: posisi tetap, coba lagi
            print(f"[paper] gagal mengambil data: {exc}")
            continue
        for bar in recent:
            if bar.ts > runner.last_ts():
                runner.step(bar)
        now = int(time.time())
        expected = now - now % cfg.bar_seconds - cfg.bar_seconds
        if runner.last_ts() < expected - 2 * cfg.bar_seconds:
            print("[paper] PERINGATAN: data basi (>2 bar tertinggal). Periksa sumber data.")


def review(state_dir: str, cfg: Config) -> str:
    """Review harian untuk MANUSIA. Tidak mengubah config atau model apa pun."""
    path = os.path.join(state_dir, "journal.jsonl")
    with open(path) as fh:
        rows = [json.loads(line) for line in fh if line.strip()]
    if len(rows) < 3:
        return "Jurnal terlalu pendek untuk direview."
    h = cfg.horizon
    pairs = []
    for k, r in enumerate(rows):
        if r["p"] is not None and k + 1 + h < len(rows):
            ret = math.log(rows[k + 1 + h]["open"] / rows[k + 1]["open"])
            pairs.append((r["p"], 1 if ret > 0 else 0))
    perf = performance([r["equity"] for r in rows], cfg.bars_per_year)
    trades = sum(1 for r in rows if r["trade"])
    states = {}
    for r in rows:
        states[r["risk_state"]] = states.get(r["risk_state"], 0) + 1
    out = ["# Review Paper Trading", "",
           f"- Bar dijurnal: {len(rows)} · trade: {trades}",
           f"- Return: {perf.get('total_return', 0):+.2%} · max DD: {perf.get('max_drawdown', 0):.2%}",
           f"- Risk state: {states}"]
    if pairs:
        cal = brier_skill(pairs)
        out.append(f"- Brier skill score (n={cal['n']}): {cal['bss']:+.4f}")
        if cal["n"] < 500:
            out.append("  - n < 500: terlalu sedikit untuk menyimpulkan apa pun. Jangan ubah model.")
    out += ["", "Perubahan parameter/model hanya lewat: backtest walk-forward baru → "
            "bandingkan dengan laporan lama → keputusan manusia → edit config manual.", ""]
    return "\n".join(out)
