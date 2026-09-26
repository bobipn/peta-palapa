"""Semua ambang batas hidup di sini, di kode — bukan di model."""

import json
from dataclasses import asdict, dataclass, fields


@dataclass
class Config:
    # Data
    bar_seconds: int = 3600          # 1 jam
    bars_per_year: float = 8760.0    # kripto 24/7

    # Model & walk-forward
    horizon: int = 1                 # label: return open[t+1] -> open[t+1+h]
    train_window: int = 24 * 90      # bar training (rolling)
    min_train: int = 24 * 30         # minimal baris training sebelum boleh trading
    refit_every: int = 24 * 7        # refit mingguan
    l2: float = 1.0                  # regularisasi logistic regression

    # Gate kebijakan
    p_min: float = 0.55              # entry bila P(naik) >= p_min
    p_exit: float = 0.50             # keluar bila P(naik) < p_exit (hysteresis)
    kelly_fraction: float = 0.25     # quarter Kelly
    max_position: float = 1.0        # fraksi ekuitas, 1.0 = tanpa leverage
    min_trade_frac: float = 0.05     # abaikan rebalance < 5% ekuitas

    # Biaya (per sisi)
    fee_bps: float = 10.0
    slippage_bps: float = 5.0

    # Risk layer (hard, deterministik)
    max_drawdown: float = 0.15       # halt permanen (latched) di -15% dari puncak
    near_limit_frac: float = 0.75    # di 75% batas DD: posisi dipotong setengah
    max_daily_loss: float = 0.03     # stop trading sampai hari UTC berikutnya
    kill_switch_path: str = "KILL"   # file ini ada => flat & halt

    initial_equity: float = 10_000.0

    @property
    def round_trip_cost(self) -> float:
        return 2.0 * (self.fee_bps + self.slippage_bps) / 1e4

    @classmethod
    def load(cls, path: str) -> "Config":
        with open(path) as fh:
            raw = json.load(fh)
        known = {f.name for f in fields(cls)}
        unknown = set(raw) - known
        if unknown:
            raise ValueError(f"Kunci config tidak dikenal: {sorted(unknown)}")
        return cls(**raw)

    def to_dict(self) -> dict:
        return asdict(self)
