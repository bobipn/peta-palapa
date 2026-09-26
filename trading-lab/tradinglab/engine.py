"""Engine bar-demi-bar. Backtest dan paper trading memakai kelas yang SAMA.

Urutan per bar baru (bar i):
  1. eksekusi target tertunda (diputuskan di close bar i-1) pada OPEN bar i,
     setelah cek kill switch;
  2. mark-to-market di CLOSE bar i;
  3. putuskan target untuk bar i+1 memakai data bars[0..i] saja.

Label training baris j = [open[j+1+h] > open[j+1]], baru diketahui di bar j+1+h,
jadi pada keputusan bar i hanya baris dengan j+1+h <= i yang boleh dipakai.
"""

import math
from typing import List, Optional

from .config import Config
from .data import Bar
from .features import WARMUP, feature_row, vector
from .model import LogisticModel
from .portfolio import Portfolio
from .regime import classify
from .risk import RiskManager, kill_switch_active
from .sizing import target_position


def forward_return(bars: List[Bar], j: int, h: int) -> Optional[float]:
    """Log return yang benar-benar bisa ditangkap: open[j+1] -> open[j+1+h]."""
    if j + 1 + h >= len(bars):
        return None
    return math.log(bars[j + 1 + h].open / bars[j + 1].open)


class Engine:
    def __init__(self, cfg: Config, trading: bool = True):
        self.cfg = cfg
        self.trading = trading
        self.bars: List[Bar] = []
        self.feats: List[Optional[dict]] = []
        self.model: Optional[LogisticModel] = None
        self.last_fit: Optional[int] = None
        self.win = 0.0          # rata-rata forward return positif (training)
        self.loss = 0.0         # rata-rata |forward return negatif| (training)
        self.portfolio = Portfolio(cfg)
        self.risk = RiskManager(cfg)
        self.pending: Optional[float] = None
        self.decisions: List[dict] = []
        self.equity_curve: List[tuple] = []   # (ts, equity, exposure)

    # --- training -----------------------------------------------------------
    def training_rows(self, i: int):
        h = self.cfg.horizon
        last_j = i - 1 - h
        first_j = max(WARMUP, last_j - self.cfg.train_window + 1)
        X, y, fwd = [], [], []
        for j in range(first_j, last_j + 1):
            r = forward_return(self.bars, j, h)
            if r is None or self.feats[j] is None:
                continue
            X.append(vector(self.feats[j]))
            y.append(1 if r > 0 else 0)
            fwd.append(r)
        return X, y, fwd

    def _maybe_fit(self, i: int) -> None:
        if self.model is not None and i - self.last_fit < self.cfg.refit_every:
            return
        X, y, fwd = self.training_rows(i)
        if len(X) < self.cfg.min_train or len(set(y)) < 2:
            return
        self.model = LogisticModel(l2=self.cfg.l2).fit(X, y)
        wins = [r for r in fwd if r > 0]
        losses = [-r for r in fwd if r < 0]
        self.win = sum(wins) / len(wins) if wins else 0.0
        self.loss = sum(losses) / len(losses) if losses else 0.0
        self.last_fit = i

    # --- loop utama ---------------------------------------------------------
    def on_bar(self, bar: Bar) -> dict:
        if self.bars and bar.ts <= self.bars[-1].ts:
            raise ValueError(f"Bar tidak urut: {bar.ts} <= {self.bars[-1].ts}")
        self.bars.append(bar)
        i = len(self.bars) - 1
        self.feats.append(feature_row(self.bars, i))

        trade = None
        if self.pending is not None and self.trading:
            target = 0.0 if kill_switch_active(self.cfg) else self.pending
            trade = self.portfolio.rebalance(target, bar.open, bar.ts)
        self.pending = None

        equity = self.portfolio.equity(bar.close)
        self.equity_curve.append((bar.ts, equity, self.portfolio.exposure(bar.close)))

        decision = self._decide(i, equity)
        decision["trade"] = trade
        decision["equity"] = equity
        if self.trading:
            self.pending = decision["target"]
        self.decisions.append(decision)
        return decision

    def _decide(self, i: int, equity: float) -> dict:
        cfg = self.cfg
        bar = self.bars[i]
        decision_ts = bar.ts + cfg.bar_seconds     # keputusan diambil saat bar tutup
        d = {"i": i, "ts": bar.ts, "p": None, "regime": None,
             "raw": 0.0, "target": 0.0, "risk_state": None, "reason": ""}
        f = self.feats[i]
        if f is None:
            d["reason"] = "warmup"
        else:
            self._maybe_fit(i)
            d["regime"] = classify(f)
            if self.model is None:
                d["reason"] = "data training belum cukup"
            else:
                p = self.model.predict_proba(vector(f))
                d["p"] = p
                holding = self.portfolio.units > 0
                if d["regime"] == "crisis":
                    d["reason"] = "gate: rezim crisis"
                elif not holding and p < cfg.p_min:
                    d["reason"] = f"gate: p<{cfg.p_min}"
                elif holding and p < cfg.p_exit:
                    d["reason"] = f"gate: p<{cfg.p_exit} (exit)"
                else:
                    # Biaya round-trip hanya dibebankan saat membuka posisi baru.
                    cost = 0.0 if holding else cfg.round_trip_cost
                    d["raw"] = target_position(p, self.win, self.loss, cost,
                                               cfg.kelly_fraction, cfg.max_position)
                    d["reason"] = "kelly" if d["raw"] > 0 else "edge < biaya"
        d["target"], d["risk_state"] = self.risk.check(d["raw"], equity, decision_ts)
        return d
