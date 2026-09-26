import math
import random

from tradinglab.config import Config
from tradinglab.data import Bar


def random_walk(n, seed=0, vol=0.01, drift=0.0, start_ts=1_700_000_000 // 3600 * 3600):
    rng = random.Random(seed)
    bars, price = [], 100.0
    for k in range(n):
        o = price
        c = o * math.exp(drift + rng.gauss(0, vol))
        h = max(o, c) * (1 + abs(rng.gauss(0, vol / 2)))
        low = min(o, c) * (1 - abs(rng.gauss(0, vol / 2)))
        bars.append(Bar(start_ts + 3600 * k, o, h, low, c, rng.uniform(50, 150)))
        price = c
    return bars


def small_cfg(**kw):
    base = dict(train_window=300, min_train=200, refit_every=50, kill_switch_path="")
    base.update(kw)
    return Config(**base)
