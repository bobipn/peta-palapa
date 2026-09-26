"""Risk layer keras. Model tidak punya jalur untuk melewati kelas ini.

Engine memanggil check() setiap keputusan, dan kill_switch_active() lagi tepat
sebelum setiap eksekusi order.
"""

import os
from datetime import datetime, timezone
from typing import Tuple

from .config import Config


def kill_switch_active(cfg: Config) -> bool:
    return bool(cfg.kill_switch_path) and os.path.exists(cfg.kill_switch_path)


def _utc_day(ts: int) -> str:
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d")


class RiskManager:
    def __init__(self, cfg: Config):
        self.cfg = cfg
        self.peak = None
        self.day = None
        self.day_start_equity = None
        self.halted = False
        self.halt_reason = ""

    def _update(self, equity: float, ts: int) -> None:
        self.peak = equity if self.peak is None else max(self.peak, equity)
        day = _utc_day(ts)
        if day != self.day:
            self.day = day
            self.day_start_equity = equity

    def drawdown(self, equity: float) -> float:
        return 0.0 if not self.peak else 1.0 - equity / self.peak

    def check(self, target: float, equity: float, ts: int) -> Tuple[float, str]:
        """Kembalikan (posisi_diizinkan, risk_state).

        risk_state: safe | near_limit | reduce | halt.
        Halt bersifat latched: hanya reset() manual yang membukanya.
        """
        cfg = self.cfg
        self._update(equity, ts)

        if kill_switch_active(cfg):
            self.halted, self.halt_reason = True, "kill switch"
        dd = self.drawdown(equity)
        if dd >= cfg.max_drawdown and not self.halted:
            self.halted, self.halt_reason = True, f"drawdown {dd:.1%} >= {cfg.max_drawdown:.0%}"
        if self.halted:
            return 0.0, "halt"

        if self.day_start_equity and 1.0 - equity / self.day_start_equity >= cfg.max_daily_loss:
            return 0.0, "reduce"

        target = min(max(target, 0.0), cfg.max_position)   # long-only, tanpa leverage
        if dd >= cfg.near_limit_frac * cfg.max_drawdown:
            return target * 0.5, "near_limit"
        return target, "safe"

    def reset(self) -> None:
        """Hanya dipanggil manusia setelah review. Tidak ada kode otomatis yang memanggil ini."""
        self.halted, self.halt_reason = False, ""
        self.peak = None

    def to_dict(self) -> dict:
        return {k: getattr(self, k) for k in
                ("peak", "day", "day_start_equity", "halted", "halt_reason")}

    def load_dict(self, d: dict) -> None:
        for k, v in d.items():
            setattr(self, k, v)
