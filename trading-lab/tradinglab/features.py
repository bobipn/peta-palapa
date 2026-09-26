"""Fitur kausal. feature_row(bars, i) HANYA boleh membaca bars[0..i].

Kontrak ini diuji di tests/test_no_lookahead.py dengan mengacak data masa depan.
"""

import math
from statistics import fmean, pstdev
from typing import Dict, List, Optional

from .data import Bar

LONG = 168   # 1 minggu bar jam-an
SHORT = 24
WARMUP = LONG  # indeks minimum dengan fitur lengkap

# Fitur yang masuk model. Input rezim (vol_168, dd_168) tidak ikut.
FEATURE_NAMES = [
    "ret_1", "mom_24", "mom_168", "vol_24", "vol_ratio",
    "z_48", "range_pos_24", "volume_z_24", "hl_range",
]


def _log_returns(bars: List[Bar], lo: int, hi: int) -> List[float]:
    """Log return bar k untuk k di [lo, hi] (inklusif); butuh lo >= 1."""
    return [math.log(bars[k].close / bars[k - 1].close) for k in range(lo, hi + 1)]


def feature_row(bars: List[Bar], i: int) -> Optional[Dict[str, float]]:
    if i < WARMUP or i >= len(bars):
        return None
    c = bars[i].close

    r_long = _log_returns(bars, i - LONG + 1, i)
    r_short = r_long[-SHORT:]
    vol_24 = pstdev(r_short)
    vol_168 = pstdev(r_long)

    closes_48 = [bars[k].close for k in range(i - 47, i + 1)]
    sd_48 = pstdev(closes_48)

    window = bars[i - SHORT + 1: i + 1]
    lo = min(b.low for b in window)
    hi = max(b.high for b in window)

    vols = [b.volume for b in window]
    sd_v = pstdev(vols)

    high_168 = max(b.high for b in bars[i - LONG + 1: i + 1])

    return {
        "ret_1": r_long[-1],
        "mom_24": math.log(c / bars[i - SHORT].close),
        "mom_168": math.log(c / bars[i - LONG].close),
        "vol_24": vol_24,
        "vol_ratio": vol_24 / vol_168 if vol_168 > 0 else 1.0,
        "z_48": (c - fmean(closes_48)) / sd_48 if sd_48 > 0 else 0.0,
        "range_pos_24": (c - lo) / (hi - lo) if hi > lo else 0.5,
        "volume_z_24": (bars[i].volume - fmean(vols)) / sd_v if sd_v > 0 else 0.0,
        "hl_range": math.log(bars[i].high / bars[i].low),
        # input rezim
        "vol_168": vol_168,
        "dd_168": c / high_168 - 1.0,
    }


def vector(f: Dict[str, float]) -> List[float]:
    return [f[name] for name in FEATURE_NAMES]
