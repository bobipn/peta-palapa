"""CLI: python -m tradinglab {fetch,backtest,paper,review} ..."""

import argparse
import os
import sys
import time

from .config import Config
from .data import count_gaps, fetch_coinbase, read_csv, write_csv


def _cfg(path):
    return Config.load(path) if path else Config()


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="tradinglab")
    sub = ap.add_subparsers(dest="cmd", required=True)

    f = sub.add_parser("fetch", help="unduh candle publik Coinbase ke CSV")
    f.add_argument("--product", default="BTC-USD")
    f.add_argument("--days", type=int, default=365)
    f.add_argument("--bar-seconds", type=int, default=3600)
    f.add_argument("--out", required=True)

    b = sub.add_parser("backtest", help="walk-forward backtest + laporan")
    b.add_argument("--data", required=True)
    b.add_argument("--config")
    b.add_argument("--report", help="tulis laporan markdown ke file ini")

    p = sub.add_parser("paper", help="paper trading live (tanpa order riil)")
    p.add_argument("--product", default="BTC-USD")
    p.add_argument("--config")
    p.add_argument("--state", default="state")
    p.add_argument("--poll", type=int, default=60)
    p.add_argument("--once", action="store_true", help="proses bar terbaru lalu keluar (untuk cron)")

    r = sub.add_parser("review", help="ringkasan jurnal paper trading untuk manusia")
    r.add_argument("--config")
    r.add_argument("--state", default="state")

    a = ap.parse_args(argv)

    if a.cmd == "fetch":
        now = int(time.time())
        end = now - now % a.bar_seconds
        bars = fetch_coinbase(a.product, a.bar_seconds, end - a.days * 86400, end, now=now)
        os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
        write_csv(bars, a.out)
        print(f"{len(bars)} bar ditulis ke {a.out} (gap: {count_gaps(bars, a.bar_seconds)})")
    elif a.cmd == "backtest":
        from .backtest import evaluate, report_markdown
        md = report_markdown(evaluate(read_csv(a.data), _cfg(a.config)),
                             title=f"Laporan Backtest — {os.path.basename(a.data)}")
        if a.report:
            os.makedirs(os.path.dirname(a.report) or ".", exist_ok=True)
            with open(a.report, "w") as fh:
                fh.write(md)
        print(md)
    elif a.cmd == "paper":
        from .paper import run_paper
        run_paper(a.product, _cfg(a.config), a.state, a.poll, a.once)
    elif a.cmd == "review":
        from .paper import review
        print(review(a.state, _cfg(a.config)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
