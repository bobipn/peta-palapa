import unittest
from dataclasses import replace

from tradinglab.engine import Engine
from tradinglab.features import WARMUP, feature_row

from .helpers import random_walk, small_cfg


class TestNoLookahead(unittest.TestCase):
    def test_features_only_use_past(self):
        bars = random_walk(400, seed=1)
        for i in (WARMUP, 250, 399):
            self.assertEqual(feature_row(bars[: i + 1], i), feature_row(bars, i))

    def test_features_none_during_warmup(self):
        bars = random_walk(300, seed=1)
        self.assertIsNone(feature_row(bars, WARMUP - 1))
        self.assertIsNotNone(feature_row(bars, WARMUP))

    def test_engine_decisions_ignore_future(self):
        """Dua deret identik s/d bar k, berbeda liar sesudahnya -> keputusan s/d k identik."""
        k = 700
        a = random_walk(900, seed=2)
        tail = random_walk(900, seed=99, vol=0.05)
        b = a[: k + 1] + [replace(t, ts=a[j].ts) for j, t in enumerate(tail) if j > k]
        # sambungkan level harga agar deret b tetap valid
        scale = a[k].close / tail[k].close
        b = b[: k + 1] + [replace(x, open=x.open * scale, high=x.high * scale,
                                  low=x.low * scale, close=x.close * scale) for x in b[k + 1:]]
        cfg = small_cfg()
        ea, eb = Engine(cfg), Engine(cfg)
        for bar in a:
            ea.on_bar(bar)
        for bar in b:
            eb.on_bar(bar)
        active = [d for d in ea.decisions[: k + 1] if d["p"] is not None]
        self.assertGreater(len(active), 100, "model harus aktif sebelum k agar tes bermakna")
        for da, db in zip(ea.decisions[: k + 1], eb.decisions[: k + 1]):
            self.assertEqual(da["p"], db["p"])
            self.assertEqual(da["target"], db["target"])
            self.assertEqual(da["trade"], db["trade"])
        self.assertNotEqual([d["p"] for d in ea.decisions[k + 1:]],
                            [d["p"] for d in eb.decisions[k + 1:]])

    def test_training_labels_known_at_decision_time(self):
        bars = random_walk(600, seed=3)
        cfg = small_cfg(horizon=3)
        i = 550
        truncated = Engine(cfg, trading=False)
        for bar in bars[: i + 1]:
            truncated.on_bar(bar)
        full = Engine(cfg, trading=False)
        for bar in bars:
            full.on_bar(bar)
        # training_rows(i) pada engine penuh harus sama dengan engine yang tidak pernah melihat > i
        self.assertEqual(truncated.training_rows(i), full.training_rows(i))
        X, _, _ = truncated.training_rows(i)
        self.assertEqual(len(X), cfg.train_window)

    def test_out_of_order_bar_rejected(self):
        bars = random_walk(5, seed=4)
        eng = Engine(small_cfg())
        eng.on_bar(bars[1])
        with self.assertRaises(ValueError):
            eng.on_bar(bars[0])


if __name__ == "__main__":
    unittest.main()
