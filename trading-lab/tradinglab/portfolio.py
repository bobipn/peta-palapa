"""Portofolio simulasi spot long-only dengan fee dan slippage. Tidak ada order riil."""

from typing import List, Optional

from .config import Config


class Portfolio:
    def __init__(self, cfg: Config):
        self.cfg = cfg
        self.cash = cfg.initial_equity
        self.units = 0.0
        self.fees_paid = 0.0
        self.slippage_paid = 0.0
        self.trades: List[dict] = []

    def equity(self, price: float) -> float:
        return self.cash + self.units * price

    def exposure(self, price: float) -> float:
        eq = self.equity(price)
        return self.units * price / eq if eq > 0 else 0.0

    def rebalance(self, target_frac: float, price: float, ts: int) -> Optional[dict]:
        """Rebalance ke target_frac dari ekuitas pada harga `price` (open bar)."""
        cfg = self.cfg
        eq = self.equity(price)
        if eq <= 0:
            return None
        target_units = max(0.0, target_frac) * eq / price
        delta = target_units - self.units
        full_exit = target_frac <= 0 and self.units > 0
        if not full_exit and abs(delta) * price < cfg.min_trade_frac * eq:
            return None

        slip = cfg.slippage_bps / 1e4
        fee_rate = cfg.fee_bps / 1e4
        if delta > 0:
            fill = price * (1 + slip)
            max_units = self.cash / (fill * (1 + fee_rate))
            qty = min(delta, max_units)
            if qty <= 0:
                return None
            notional = qty * fill
            fee = notional * fee_rate
            self.cash -= notional + fee
            self.units += qty
            side = "buy"
        else:
            qty = self.units if full_exit else -delta
            fill = price * (1 - slip)
            notional = qty * fill
            fee = notional * fee_rate
            self.cash += notional - fee
            self.units -= qty
            if self.units < 1e-12:
                self.units = 0.0
            side = "sell"
        self.fees_paid += fee
        self.slippage_paid += qty * price * slip
        trade = {"ts": ts, "side": side, "qty": qty, "price": price, "fill": fill,
                 "fee": fee, "equity_after": self.equity(price)}
        self.trades.append(trade)
        return trade

    def to_dict(self) -> dict:
        return {"cash": self.cash, "units": self.units,
                "fees_paid": self.fees_paid, "slippage_paid": self.slippage_paid}

    def load_dict(self, d: dict) -> None:
        for k, v in d.items():
            setattr(self, k, v)
