"""Klasifikasi rezim berbasis aturan — deterministik, dapat diaudit, tanpa model."""

import math
from typing import Dict

from .features import LONG

CRISIS_VOL_RATIO = 2.5
CRISIS_DRAWDOWN = -0.15
HIGH_VOL_RATIO = 1.5
TREND_STRENGTH = 1.0

REGIMES = ("trending", "mean_reverting", "high_vol", "crisis")


def classify(f: Dict[str, float]) -> str:
    if f["vol_ratio"] >= CRISIS_VOL_RATIO or f["dd_168"] <= CRISIS_DRAWDOWN:
        return "crisis"
    if f["vol_ratio"] >= HIGH_VOL_RATIO:
        return "high_vol"
    scale = f["vol_168"] * math.sqrt(LONG)
    if scale > 0 and abs(f["mom_168"]) / scale >= TREND_STRENGTH:
        return "trending"
    return "mean_reverting"
