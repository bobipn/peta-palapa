import os
import tempfile
import unittest

from tradinglab.engine import Engine
from tradinglab.risk import RiskManager

from .helpers import random_walk, small_cfg

DAY = 86400
T0 = 1_700_006_400  # 00:00 UTC


class TestRisk(unittest.TestCase):
    def test_drawdown_halt_is_latched(self):
        r = RiskManager(small_cfg(max_daily_loss=1.0))
        self.assertEqual(r.check(1.0, 100.0, T0), (1.0, "safe"))
        self.assertEqual(r.check(1.0, 84.0, T0 + DAY), (0.0, "halt"))
        # pulih di atas puncak pun tetap halt sampai reset manual
        self.assertEqual(r.check(1.0, 120.0, T0 + 2 * DAY), (0.0, "halt"))
        r.reset()
        self.assertEqual(r.check(1.0, 120.0, T0 + 3 * DAY)[1], "safe")

    def test_near_limit_halves_position(self):
        r = RiskManager(small_cfg(max_daily_loss=1.0))
        r.check(1.0, 100.0, T0)
        self.assertEqual(r.check(1.0, 88.0, T0 + DAY), (0.5, "near_limit"))

    def test_daily_loss_blocks_until_next_day(self):
        r = RiskManager(small_cfg(max_daily_loss=0.03))
        r.check(1.0, 100.0, T0)
        self.assertEqual(r.check(1.0, 96.0, T0 + 3600), (0.0, "reduce"))
        self.assertEqual(r.check(1.0, 96.0, T0 + DAY)[1], "safe")

    def test_clamps_position(self):
        r = RiskManager(small_cfg(max_position=0.5))
        self.assertEqual(r.check(3.0, 100.0, T0), (0.5, "safe"))
        self.assertEqual(r.check(-1.0, 100.0, T0), (0.0, "safe"))

    def test_kill_switch_flattens_before_order(self):
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "KILL")
            cfg = small_cfg(kill_switch_path=path)
            eng = Engine(cfg)
            bars = random_walk(3, seed=5)
            eng.on_bar(bars[0])
            eng.portfolio.rebalance(1.0, bars[0].close, bars[0].ts)
            eng.pending = 1.0
            open(path, "w").close()
            eng.on_bar(bars[1])
            self.assertEqual(eng.portfolio.units, 0.0)
            self.assertEqual(eng.decisions[-1]["risk_state"], "halt")


if __name__ == "__main__":
    unittest.main()
