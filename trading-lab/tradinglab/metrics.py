"""Metrik performa dan kalibrasi."""

import math
from typing import Dict, List, Sequence, Tuple


def returns_from_equity(equity: Sequence[float]) -> List[float]:
    return [b / a - 1.0 for a, b in zip(equity, equity[1:]) if a > 0]


def max_drawdown(equity: Sequence[float]) -> float:
    peak, mdd = -math.inf, 0.0
    for e in equity:
        peak = max(peak, e)
        mdd = max(mdd, 1.0 - e / peak)
    return mdd


def performance(equity: Sequence[float], bars_per_year: float) -> Dict[str, float]:
    rets = returns_from_equity(equity)
    n = len(rets)
    if n < 2:
        return {"bars": n}
    mean = sum(rets) / n
    var = sum((r - mean) ** 2 for r in rets) / (n - 1)
    sd = math.sqrt(var)
    total = equity[-1] / equity[0] - 1.0
    years = n / bars_per_year
    return {
        "bars": n,
        "total_return": total,
        "cagr": (equity[-1] / equity[0]) ** (1 / years) - 1.0 if years > 0 and equity[-1] > 0 else float("nan"),
        "sharpe": mean / sd * math.sqrt(bars_per_year) if sd > 0 else 0.0,
        # t-stat rata-rata return per bar. Mengabaikan autokorelasi -> cenderung optimistis.
        "t_stat": mean / (sd / math.sqrt(n)) if sd > 0 else 0.0,
        "max_drawdown": max_drawdown(equity),
    }


def brier(pairs: Sequence[Tuple[float, int]]) -> float:
    return sum((p - y) ** 2 for p, y in pairs) / len(pairs)


def brier_skill(pairs: Sequence[Tuple[float, int]]) -> Dict[str, float]:
    """BSS terhadap base rate out-of-sample (baseline terbaik yang konstan -> ketat)."""
    base_rate = sum(y for _, y in pairs) / len(pairs)
    b = brier(pairs)
    b_ref = brier([(base_rate, y) for _, y in pairs])
    return {"n": len(pairs), "brier": b, "brier_base": b_ref, "base_rate": base_rate,
            "bss": 1.0 - b / b_ref if b_ref > 0 else 0.0}


def reliability(pairs: Sequence[Tuple[float, int]], bins: int = 10) -> List[Dict[str, float]]:
    buckets: List[List[Tuple[float, int]]] = [[] for _ in range(bins)]
    for p, y in pairs:
        buckets[min(int(p * bins), bins - 1)].append((p, y))
    out = []
    for k, bucket in enumerate(buckets):
        if bucket:
            out.append({"lo": k / bins, "hi": (k + 1) / bins, "n": len(bucket),
                        "mean_p": sum(p for p, _ in bucket) / len(bucket),
                        "freq": sum(y for _, y in bucket) / len(bucket)})
    return out
