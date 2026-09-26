"""Data OHLCV: model Bar, CSV I/O, dan fetcher publik Coinbase (tanpa API key)."""

import csv
import json
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import List

COINBASE_URL = "https://api.exchange.coinbase.com/products/{product}/candles"
USER_AGENT = "tradinglab/0.1"
MAX_CANDLES_PER_REQUEST = 300


@dataclass(frozen=True)
class Bar:
    ts: int        # waktu BUKA bar, epoch detik UTC
    open: float
    high: float
    low: float
    close: float
    volume: float


def write_csv(bars: List[Bar], path: str) -> None:
    with open(path, "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["ts", "open", "high", "low", "close", "volume"])
        for b in bars:
            w.writerow([b.ts, b.open, b.high, b.low, b.close, b.volume])


def read_csv(path: str) -> List[Bar]:
    with open(path, newline="") as fh:
        rows = list(csv.DictReader(fh))
    bars = [
        Bar(int(r["ts"]), float(r["open"]), float(r["high"]), float(r["low"]),
            float(r["close"]), float(r["volume"]))
        for r in rows
    ]
    validate(bars)
    return bars


def validate(bars: List[Bar]) -> None:
    """Tolak data yang tidak urut/duplikat — sumber lookahead paling umum."""
    for prev, cur in zip(bars, bars[1:]):
        if cur.ts <= prev.ts:
            raise ValueError(f"Bar tidak urut/duplikat di ts={cur.ts}")
    for b in bars:
        if min(b.open, b.high, b.low, b.close) <= 0:
            raise ValueError(f"Harga non-positif di ts={b.ts}")


def count_gaps(bars: List[Bar], bar_seconds: int) -> int:
    """Jumlah bar yang hilang. Fitur berbasis indeks mengasumsikan deret kontinu."""
    return sum((cur.ts - prev.ts) // bar_seconds - 1 for prev, cur in zip(bars, bars[1:]))


def _get_json(url: str, retries: int = 4):
    delay = 2.0
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=20) as resp:
                return json.load(resp)
        except (urllib.error.URLError, TimeoutError) as exc:
            if attempt == retries:
                raise
            print(f"[data] gagal ({exc}); coba lagi dalam {delay:.0f}s")
            time.sleep(delay)
            delay *= 2


def _iso(ts: int) -> str:
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def fetch_coinbase(product: str, bar_seconds: int, start: int, end: int,
                   now: int = None) -> List[Bar]:
    """Ambil candle tertutup [start, end). Candle yang belum tutup DIBUANG."""
    now = int(time.time()) if now is None else now
    out = {}
    chunk = bar_seconds * MAX_CANDLES_PER_REQUEST
    t = start
    while t < end:
        t2 = min(t + chunk, end)
        url = (COINBASE_URL.format(product=product)
               + f"?granularity={bar_seconds}&start={_iso(t)}&end={_iso(t2)}")
        for row in _get_json(url):
            ts, low, high, opn, close, vol = row
            ts = int(ts)
            if start <= ts < end and ts + bar_seconds <= now:
                out[ts] = Bar(ts, float(opn), float(high), float(low), float(close), float(vol))
        t = t2
        time.sleep(0.25)  # sopan terhadap rate limit publik
    bars = [out[k] for k in sorted(out)]
    validate(bars)
    return bars


def fetch_recent(product: str, bar_seconds: int, n_bars: int) -> List[Bar]:
    now = int(time.time())
    end = now - now % bar_seconds          # awal bar yang sedang berjalan
    start = end - n_bars * bar_seconds
    return fetch_coinbase(product, bar_seconds, start, end, now=now)
