import math
import random
import unittest

from tradinglab.config import Config
from tradinglab.model import LogisticModel, solve
from tradinglab.portfolio import Portfolio
from tradinglab.sizing import kelly_binary, target_position


class TestKelly(unittest.TestCase):
    def test_even_money(self):
        self.assertAlmostEqual(kelly_binary(0.6, 1.0, 1.0), 0.2)

    def test_no_edge_is_zero(self):
        self.assertEqual(kelly_binary(0.5, 1.0, 1.0), 0.0)
        self.assertEqual(kelly_binary(0.4, 1.0, 1.0), 0.0)

    def test_cost_can_kill_edge(self):
        self.assertGreater(target_position(0.55, 0.01, 0.01, 0.0, 0.25, 1.0), 0)
        self.assertEqual(target_position(0.55, 0.01, 0.01, 0.003, 0.25, 1.0), 0.0)

    def test_capped(self):
        self.assertEqual(target_position(0.9, 0.01, 0.01, 0.0, 0.25, 1.0), 1.0)


class TestPortfolio(unittest.TestCase):
    def test_round_trip_pays_costs(self):
        cfg = Config(fee_bps=10, slippage_bps=5)
        pf = Portfolio(cfg)
        pf.rebalance(1.0, 100.0, 0)
        self.assertGreaterEqual(pf.cash, 0.0)
        pf.rebalance(0.0, 100.0, 1)
        self.assertEqual(pf.units, 0.0)
        loss = 1 - pf.cash / cfg.initial_equity
        self.assertAlmostEqual(loss, 0.003, delta=0.0002)

    def test_min_trade_band(self):
        pf = Portfolio(Config(min_trade_frac=0.05))
        pf.rebalance(0.5, 100.0, 0)
        self.assertIsNone(pf.rebalance(0.52, 100.0, 1))
        self.assertIsNotNone(pf.rebalance(0.0, 100.0, 2))


class TestModel(unittest.TestCase):
    def test_solve(self):
        x = solve([[2.0, 1.0], [1.0, 3.0]], [3.0, 5.0])
        self.assertAlmostEqual(x[0], 0.8)
        self.assertAlmostEqual(x[1], 1.4)

    def test_recovers_signal(self):
        rng = random.Random(0)
        X, y = [], []
        for _ in range(2000):
            a, b = rng.gauss(0, 1), rng.gauss(0, 1)
            p = 1 / (1 + math.exp(-(1.5 * a)))
            X.append([a, b])
            y.append(1 if rng.random() < p else 0)
        m = LogisticModel(l2=0.1).fit(X, y)
        self.assertGreater(m.w[1], 1.0)
        self.assertLess(abs(m.w[2]), 0.2)
        self.assertGreater(m.predict_proba([2.0, 0.0]), 0.9)


if __name__ == "__main__":
    unittest.main()
