/**
 * Quote pricing and revenue allocation (pure).
 *
 * All amounts are whole IDR (bigint-safe JS numbers). Prices are DEMO numbers.
 *
 * Model:
 *   provider wholesale W_i = sum over provider i's segments of price_per_gbps_month x Gbps
 *                            (both primary and protection paths are paid for in 1+1)
 *   W = sum W_i
 *   Fee basis (configurable, NOT agreed commercially):
 *     GROSS     : fee = rate x P, so P = W / (1 - rate)
 *     WHOLESALE : fee = rate x W, so P = W x (1 + rate)
 *   Every provider receives exactly its W_i; the platform keeps P - W.
 *   Tax (if configured) is added on top of P and recorded separately.
 *   Rounding: P is rounded up to whole IDR; fee = P - W so the ledger always sums exactly.
 */
export interface PricedSegment {
  segmentId: string;
  providerId: string;
  pricePerGbpsMonth: number;
  setupFee: number;
  role: 'PRIMARY' | 'PROTECTION';
}

export interface FeeConfig {
  rate: number;
  basis: 'GROSS' | 'WHOLESALE';
}

export interface ProviderShare {
  providerId: string;
  segmentIds: string[];
  wholesaleMonthly: number;
  setupFee: number;
}

export interface PriceBreakdown {
  bandwidthMbps: number;
  providers: ProviderShare[];
  wholesaleMonthly: number;
  platformFeeMonthly: number;
  customerMonthly: number;
  setupFee: number;
  taxRate: number;
  taxMonthly: number;
  fee: FeeConfig;
  note: string;
}

export function priceRoute(segs: PricedSegment[], bandwidthMbps: number, fee: FeeConfig, taxRate = 0): PriceBreakdown {
  if (fee.rate < 0 || fee.rate >= 1) throw new Error('platform fee rate must be in [0, 1)');
  const gbps = bandwidthMbps / 1000;
  const byProvider = new Map<string, ProviderShare>();
  for (const s of segs) {
    const share = byProvider.get(s.providerId) ?? { providerId: s.providerId, segmentIds: [], wholesaleMonthly: 0, setupFee: 0 };
    share.segmentIds.push(s.segmentId);
    share.wholesaleMonthly += Math.round(s.pricePerGbpsMonth * gbps);
    share.setupFee += s.setupFee;
    byProvider.set(s.providerId, share);
  }
  const providers = [...byProvider.values()];
  const W = providers.reduce((a, p) => a + p.wholesaleMonthly, 0);
  const P = fee.basis === 'GROSS' ? Math.ceil(W / (1 - fee.rate)) : Math.ceil(W * (1 + fee.rate));
  const setup = providers.reduce((a, p) => a + p.setupFee, 0);
  return {
    bandwidthMbps,
    providers,
    wholesaleMonthly: W,
    platformFeeMonthly: P - W,
    customerMonthly: P,
    setupFee: setup,
    taxRate,
    taxMonthly: Math.round(P * taxRate),
    fee,
    note: 'SIMULATED price from DEMO rate cards. Not a tariff or offer.',
  };
}

export interface LedgerLine {
  entryType: 'CUSTOMER_CHARGE' | 'PROVIDER_ALLOCATION' | 'PLATFORM_FEE' | 'TAX' | 'SETUP_CHARGE';
  partyType: 'CUSTOMER' | 'PROVIDER' | 'PLATFORM' | 'TAX_AUTHORITY';
  partyId: string | null;
  amount: number;
}

/** Ledger lines for one monthly period. Invariant: charge = sum(allocations) + fee. */
export function ledgerLines(b: PriceBreakdown, customerId: string): LedgerLine[] {
  const lines: LedgerLine[] = [
    { entryType: 'CUSTOMER_CHARGE', partyType: 'CUSTOMER', partyId: customerId, amount: b.customerMonthly },
    ...b.providers.map((p) => ({ entryType: 'PROVIDER_ALLOCATION' as const, partyType: 'PROVIDER' as const, partyId: p.providerId, amount: p.wholesaleMonthly })),
    { entryType: 'PLATFORM_FEE', partyType: 'PLATFORM', partyId: null, amount: b.platformFeeMonthly },
  ];
  if (b.taxMonthly > 0) lines.push({ entryType: 'TAX', partyType: 'TAX_AUTHORITY', partyId: null, amount: b.taxMonthly });
  if (b.setupFee > 0) lines.push({ entryType: 'SETUP_CHARGE', partyType: 'CUSTOMER', partyId: customerId, amount: b.setupFee });
  return lines;
}
