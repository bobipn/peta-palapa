import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, bw, dt, get, idr, km, ms, post } from '../api';
import { Badge, ErrorBox, PageHead, PathChain, SimBadge, useAction, useApi } from '../components/ui';
import { TopologyMap } from '../components/TopologyMap';

interface Form {
  aLocationId: string; bLocationId: string; bandwidthMbps: number; protection: 'NONE' | 'PROTECTED';
  productId: string; slaProfileId: string; objective: 'LATENCY' | 'COST' | 'BALANCED'; termMonths: number;
}

export function MarketplacePage({ mode }: { mode: 'customer' | 'explorer' }) {
  const nav = useNavigate();
  const locs = useApi(() => get('/api/locations'), []);
  const products = useApi(() => get('/api/products'), []);
  const slas = useApi(() => get('/api/sla-profiles'), []);
  const topo = useApi(() => (mode === 'explorer' ? get('/api/topology') : Promise.resolve(null)), []);
  const [f, setF] = useState<Form>({ aLocationId: 'jkt', bLocationId: 'tte', bandwidthMbps: 1000, protection: 'NONE', productId: 'prd-epl', slaProfileId: 'sla-domestic', objective: 'LATENCY', termMonths: 12 });
  const [result, setResult] = useState<any>(null);
  const [selected, setSelected] = useState(0);
  const [quote, setQuote] = useState<any>(null);
  const search = useAction();
  const quoting = useAction();

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  useEffect(() => { setResult(null); setQuote(null); }, [f.aLocationId, f.bLocationId, f.bandwidthMbps, f.protection, f.slaProfileId, f.objective, f.productId]);

  const doSearch = () => search.run(async () => {
    const r = await post('/api/routes/search', { aLocationId: f.aLocationId, bLocationId: f.bLocationId, bandwidthMbps: f.bandwidthMbps, protection: f.protection, slaProfileId: f.slaProfileId, productId: f.productId, objective: f.objective });
    setResult(r);
    setSelected(0);
    setQuote(null);
  });
  const doQuote = () => quoting.run(async () => {
    const c = result.candidates[selected];
    setQuote(await post('/api/quotes', { ...f, routeSignature: c.signature }, true));
  });
  const doAccept = () => quoting.run(async () => {
    const o = await post(`/api/quotes/${quote.id}/accept`, {}, true);
    nav(`/orders/${o.order.id}`);
  });

  const cand = result?.candidates?.[selected];
  const highlight = useMemo(() => (cand ? { primary: cand.primary.segmentIds, protection: cand.protection?.segmentIds ?? [] } : undefined), [cand]);
  const sameEnds = f.aLocationId === f.bLocationId;

  return (
    <div className="stack">
      <PageHead title={mode === 'customer' ? 'Marketplace' : 'Route Explorer'} sub={mode === 'customer' ? 'Find a route, compare providers, get a quote and order — all simulated.' : 'Compare feasible routes and constraints without creating a quote.'}>
        <SimBadge />
      </PageHead>
      <div className="card">
        <div className="form-grid">
          <label className="f">A-end<select value={f.aLocationId} onChange={(e) => set('aLocationId', e.target.value)}>{locs.data?.map((l: any) => <option key={l.id} value={l.id}>{l.city} ({l.country_code})</option>)}</select></label>
          <label className="f">B-end<select value={f.bLocationId} onChange={(e) => set('bLocationId', e.target.value)}>{locs.data?.map((l: any) => <option key={l.id} value={l.id}>{l.city} ({l.country_code})</option>)}</select></label>
          <label className="f">Bandwidth (Mbps)<input type="number" min={1} max={400000} value={f.bandwidthMbps} onChange={(e) => set('bandwidthMbps', Number(e.target.value))} /></label>
          <label className="f">Service type<select value={f.productId} onChange={(e) => set('productId', e.target.value)}>{products.data?.map((p: any) => <option key={p.id} value={p.id}>{p.code} — {bw(p.min_mbps)}–{bw(p.max_mbps)}</option>)}</select></label>
          <label className="f">SLA profile<select value={f.slaProfileId} onChange={(e) => set('slaProfileId', e.target.value)}>{slas.data?.map((s: any) => <option key={s.id} value={s.id}>{s.name} — ≤{s.latency_ms} ms</option>)}</select></label>
          <label className="f">Protection<select value={f.protection} onChange={(e) => set('protection', e.target.value as Form['protection'])}><option value="NONE">Unprotected (auto-reroute)</option><option value="PROTECTED">1+1 protected (diverse path)</option></select></label>
          <label className="f">Optimise for<select value={f.objective} onChange={(e) => set('objective', e.target.value as Form['objective'])}><option value="LATENCY">Lowest latency</option><option value="COST">Lowest cost</option><option value="BALANCED">Balanced</option></select></label>
          {mode === 'customer' ? <label className="f">Term (months)<input type="number" min={1} max={120} value={f.termMonths} onChange={(e) => set('termMonths', Number(e.target.value))} /></label> : null}
          <button className="primary" onClick={doSearch} disabled={search.busy || sameEnds}>{search.busy ? 'Searching…' : 'Search routes'}</button>
        </div>
        {sameEnds ? <div className="small muted" style={{ marginTop: 8 }}>A and B must differ.</div> : null}
        <div className="small muted" style={{ marginTop: 8 }}>{slas.data?.find((s: any) => s.id === f.slaProfileId)?.note}</div>
      </div>
      <ErrorBox error={search.error} />

      {result && !result.feasible ? (
        <div className="alert warn">
          <strong>No feasible route: {result.reason}</strong> — {result.explanation}
          {result.alternatives?.map((a: any) => (
            <div key={a.kind} className="row" style={{ marginTop: 6 }}>
              <span>Alternative: {a.description}</span>
              {a.kind === 'LOWER_BANDWIDTH' ? <button className="sm" onClick={() => set('bandwidthMbps', a.bandwidthMbps)}>Use {bw(a.bandwidthMbps)}</button> : null}
              {a.kind === 'UNPROTECTED' ? <button className="sm" onClick={() => set('protection', 'NONE')}>Switch to unprotected</button> : null}
            </div>
          ))}
        </div>
      ) : null}

      {result?.feasible ? (
        <div className="grid g2" style={{ gridTemplateColumns: 'minmax(0, 1.7fr) minmax(0, 1fr)' }}>
          <div className="card stack">
            <div className="row between"><h2>Candidate routes ({result.candidates.length})</h2><span className="small muted">{result.note}</span></div>
            <div className="table-wrap">
              <table>
                <thead><tr><th></th><th>Path</th><th className="num">Latency</th><th className="num">Length</th><th>Providers</th><th className="num">Price / month</th><th>SLA</th></tr></thead>
                <tbody>
                  {result.candidates.map((c: any, i: number) => (
                    <tr key={c.signature} className="click" onClick={() => { setSelected(i); setQuote(null); }} style={i === selected ? { outline: '2px solid var(--accent)', outlineOffset: -2 } : undefined}>
                      <td><input type="radio" checked={i === selected} readOnly aria-label={`Select route ${i + 1}`} /></td>
                      <td>
                        <PathChain segments={c.primary.segmentIds} />
                        {c.protection ? <div style={{ marginTop: 4 }}><span className="small muted">protection: </span><PathChain segments={c.protection.segmentIds} /></div> : null}
                      </td>
                      <td className="num">{ms(c.primary.latencyMs)}{c.protection ? <div className="small muted">{ms(c.protection.latencyMs)}</div> : null}</td>
                      <td className="num">{km(c.primary.lengthKm)}</td>
                      <td className="small">{[...new Set([...c.primary.providerNames, ...(c.protection?.providerNames ?? [])])].map((n: string) => <div key={n}>{n}</div>)}</td>
                      <td className="num">{idr(c.price.customerMonthly)}</td>
                      <td>{c.meetsSla === null ? '—' : c.meetsSla ? <Badge v="meets" tone="ok" /> : <Badge v="misses" tone="bad" />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card stack">
            {mode === 'explorer' && topo.data ? <TopologyMap topo={topo.data} highlight={highlight} /> : null}
            {cand ? <PriceBreakdown price={cand.price} /> : null}
            {mode === 'customer' ? (
              <>
                <ErrorBox error={quoting.error} />
                {!quote ? (
                  <button className="primary" onClick={doQuote} disabled={quoting.busy}>Request quote for selected route</button>
                ) : (
                  <div className="alert info stack" style={{ gap: 6 }}>
                    <div><strong>Quote {quote.id}</strong> — {idr(quote.price_monthly)}/month + {idr(quote.setup_fee)} one-time · valid until {dt(quote.valid_until)}</div>
                    <div className="small">DEMO price from synthetic rate cards. Accepting creates an order awaiting simulated payment.</div>
                    <div><button className="primary" onClick={doAccept} disabled={quoting.busy}>Accept quote → checkout</button></div>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      ) : null}
      {search.error instanceof ApiError && search.error.status === 403 ? <div className="alert warn">Your role cannot search routes.</div> : null}
    </div>
  );
}

export function PriceBreakdown({ price }: { price: any }) {
  return (
    <div>
      <h3>Price breakdown (monthly, SIMULATED)</h3>
      <table>
        <tbody>
          {price.providers.map((p: any) => (
            <tr key={p.providerId}><td>{p.providerId}<div className="small muted">{p.segmentIds.length} segment(s)</div></td><td className="num">{idr(p.wholesaleMonthly)}</td></tr>
          ))}
          <tr><td>Wholesale subtotal</td><td className="num">{idr(price.wholesaleMonthly)}</td></tr>
          <tr><td>Platform fee <span className="small muted">({price.fee.rate * 100}% {price.fee.basis} — DEMO, basis not agreed)</span></td><td className="num">{idr(price.platformFeeMonthly)}</td></tr>
          <tr><th>Customer price</th><th className="num">{idr(price.customerMonthly)}</th></tr>
          {price.taxMonthly ? <tr><td>Tax ({price.taxRate * 100}%)</td><td className="num">{idr(price.taxMonthly)}</td></tr> : null}
          <tr><td>One-time setup</td><td className="num">{idr(price.setupFee)}</td></tr>
        </tbody>
      </table>
    </div>
  );
}
