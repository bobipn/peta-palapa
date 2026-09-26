"""Tes 'kejujuran': pada random walk, sistem TIDAK boleh mengklaim edge."""

import os
import tempfile
import unittest

from tradinglab.backtest import evaluate, verdict
from tradinglab.paper import PaperRunner

from .helpers import random_walk, small_cfg


class TestHonesty(unittest.TestCase):
    def test_no_edge_on_random_walk(self):
        res = evaluate(random_walk(2500, seed=7), small_cfg())
        self.assertLess(res["calibration"]["bss"], 0.01)
        self.assertTrue(verdict(res), "vonis harus GAGAL pada data acak")


class TestPaperRestart(unittest.TestCase):
    def test_state_survives_restart(self):
        bars = random_walk(700, seed=8, drift=0.001)
        cfg = small_cfg()
        with tempfile.TemporaryDirectory() as d:
            r1 = PaperRunner("TEST-USD", cfg, d, quiet=True)
            for b in r1.bootstrap(bars[:600]):
                r1.step(b)
            for b in bars[600:650]:
                r1.step(b)
            snap = r1.engine.portfolio.to_dict()

            r2 = PaperRunner("TEST-USD", cfg, d, quiet=True)
            live = r2.bootstrap(bars[:700])
            self.assertEqual(r2.engine.portfolio.to_dict(), snap)
            self.assertEqual([b.ts for b in live], [b.ts for b in bars[650:700]])
            self.assertTrue(os.path.exists(os.path.join(d, "journal.jsonl")))

            with self.assertRaises(ValueError):
                PaperRunner("OTHER-USD", cfg, d, quiet=True).bootstrap(bars[:700])


if __name__ == "__main__":
    unittest.main()
