import { useMemo, useState } from 'react';
import { SimBadge } from './ui';
import { LAND_PATH } from './basemap';
import { DeviceGlyph, type DeviceState } from './DeviceIcon';

export interface Topo {
  locations: any[];
  nodes: any[];
  segments: any[];
  providers: any[];
  label?: string;
}

export interface Highlight {
  primary?: string[];
  protection?: string[];
  reroute?: string[];
  active?: 'PRIMARY' | 'PROTECTION' | 'REROUTE' | null;
}

export const PROVIDER_COLORS: Record<string, string> = {
  'prv-alpha': '#1f7ae0', 'prv-bravo': '#0f9d6b', 'prv-charlie': '#6b4fd8', 'prv-delta': '#d9822b', 'prv-echo': '#c2417a',
};

// Equirectangular, Pacific-centred (longitudes < 0 wrap to > 180). Schematic only.
const LON0 = 96, LON1 = 250, LAT0 = -38, LAT1 = 40;
const W = 1000;
const H = Math.round((W * (LAT1 - LAT0)) / (LON1 - LON0));
const px = (lon: number) => (((lon < 0 ? lon + 360 : lon) - LON0) / (LON1 - LON0)) * W;
const py = (lat: number) => ((LAT1 - lat) / (LAT1 - LAT0)) * H;
const REGIONS = {
  ALL: { label: 'Asia-Pacific', box: [0, 0, W, H] },
  ID: { label: 'Indonesia', box: [px(100), py(7), px(132) - px(100), py(-13) - py(7)] },
} as const;
/** Global map convention: DOWN = red, carrying an active service = green, up but no service yet = blue (idle). */
const nodeState = (n: any): DeviceState => (n.oper_status === 'DOWN' ? 'DOWN' : n.active_services > 0 ? 'ACTIVE' : 'IDLE');
const LABEL_DX: Record<string, [number, number]> = { btm: [-10, 24], sin: [-70, -8], jkt: [-56, 18], bal: [-14, 24], sby: [-10, -14], kdi: [10, 18], mks: [-70, 6] };

export function TopologyMap({ topo, highlight, selected, onSelect, height }: {
  topo: Topo;
  highlight?: Highlight;
  selected?: { kind: 'node' | 'segment'; id: string } | null;
  onSelect?: (s: { kind: 'node' | 'segment'; id: string }) => void;
  height?: number;
}) {
  const [region, setRegion] = useState<keyof typeof REGIONS>('ALL');
  const box = REGIONS[region].box;
  const k = W / box[2]; // zoom factor: keep text/markers constant on screen
  const nodePos = useMemo(() => {
    const loc = new Map(topo.locations.map((l: any) => [l.id, l]));
    return new Map(topo.nodes.map((n: any) => {
      const l: any = loc.get(n.location_id);
      return [n.id, { x: px(l.lon), y: py(l.lat), loc: l, node: n }];
    }));
  }, [topo]);

  const hl = (id: string) => {
    if (!highlight) return null;
    if (highlight.reroute?.includes(id)) return 'reroute';
    if (highlight.primary?.includes(id)) return 'primary';
    if (highlight.protection?.includes(id)) return 'protection';
    return null;
  };
  const dim = !!highlight && !!(highlight.primary?.length || highlight.protection?.length || highlight.reroute?.length);

  return (
    <div className="map">
      <div className="row" style={{ marginBottom: 6 }}>
        {(Object.keys(REGIONS) as (keyof typeof REGIONS)[]).map((r) => (
          <button key={r} className={`sm ${region === r ? 'primary' : ''}`} onClick={() => setRegion(r)}>{REGIONS[r].label}</button>
        ))}
      </div>
      <svg viewBox={box.join(' ')} style={height ? { maxHeight: height } : undefined} role="img" aria-label="Schematic simulated network topology">
        <title>Simulated topology (schematic straight lines, not cable routes)</title>
        {/* basemap: Natural Earth land, same equirectangular projection as px/py */}
        <rect x={0} y={0} width={W} height={H} fill="var(--sea)" />
        <path d={LAND_PATH} transform={`matrix(${W / (LON1 - LON0)} 0 0 ${H / (LAT1 - LAT0)} ${(-LON0 * W) / (LON1 - LON0)} ${(LAT1 * H) / (LAT1 - LAT0)})`}
          fill="var(--land)" stroke="var(--land-edge)" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
        {/* graticule */}
        {[-30, -15, 0, 15, 30].map((lat) => <line key={`la${lat}`} x1={0} x2={W} y1={py(lat)} y2={py(lat)} stroke="var(--border)" vectorEffect="non-scaling-stroke" strokeWidth={lat === 0 ? 1.2 : 0.6} strokeDasharray={lat === 0 ? '' : '3 6'} />)}
        {[105, 120, 135, 150, 165, 180, 195, 210, 225, 240].map((lon) => <line key={`lo${lon}`} y1={0} y2={H} x1={px(lon > 180 ? lon - 360 : lon)} x2={px(lon > 180 ? lon - 360 : lon)} stroke="var(--border)" vectorEffect="non-scaling-stroke" strokeWidth={0.6} strokeDasharray="3 6" />)}
        <text x={6} y={py(0) - 4} fontSize={10 / k} fill="var(--muted)" style={{ stroke: 'none' }}>Equator</text>
        <text x={px(180) + 4} y={14} fontSize={10 / k} fill="var(--muted)" style={{ stroke: 'none' }}>180°</text>

        {topo.segments.map((s: any) => {
          const a = nodePos.get(s.aNodeId), b = nodePos.get(s.bNodeId);
          if (!a || !b) return null;
          const h = hl(s.id);
          const down = s.operStatus === 'DOWN' || s.adminStatus === 'DOWN';
          const degraded = s.operStatus === 'DEGRADED';
          const isSel = selected?.kind === 'segment' && selected.id === s.id;
          const base = PROVIDER_COLORS[s.providerId] ?? 'var(--muted)';
          const color = down ? 'var(--bad)' : h === 'primary' ? '#00b3ff' : h === 'protection' ? '#a855f7' : h === 'reroute' ? '#f59e0b' : degraded ? 'var(--warn)' : base;
          const width = h ? 5 : Math.max(1.5, Math.min(5, (s.capacityMbps ?? 20000) / 25000));
          const opacity = dim && !h ? 0.25 : 0.9;
          return (
            <g key={s.id} className="seg" onClick={() => onSelect?.({ kind: 'segment', id: s.id })}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={14} vectorEffect="non-scaling-stroke" />
              {isSel ? <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--text)" strokeWidth={width + 4} opacity={0.25} vectorEffect="non-scaling-stroke" /> : null}
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={width} opacity={opacity} vectorEffect="non-scaling-stroke"
                strokeDasharray={down ? '6 5' : h === 'protection' && highlight?.active !== 'PROTECTION' ? '8 4' : undefined} strokeLinecap="round">
                <title>{`${s.id} · ${s.operStatus}${s.capacityMbps ? ` · ${s.reservedMbps}/${s.capacityMbps} Mbps` : ''} · ${Math.round(s.lengthKm)} km`}</title>
              </line>
              {down ? <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2} fontSize={14 / k} textAnchor="middle" fill="var(--bad)" style={{ fontWeight: 700 }}>✕</text> : null}
            </g>
          );
        })}

        {[...nodePos.entries()].map(([id, p]) => {
          const isSel = selected?.kind === 'node' && selected.id === id;
          const [dx, dy] = LABEL_DX[p.loc.id] ?? [14, 4];
          return (
            <g key={id} className="node" onClick={() => onSelect?.({ kind: 'node', id })}>
              <DeviceGlyph x={p.x} y={p.y} scale={0.62 / k} state={nodeState(p.node)} selected={isSel}
                title={`${p.loc.city} — ${p.node.name} (${p.node.pop_kind}) · ${p.node.oper_status} · ${p.node.active_services ?? 0} layanan aktif`} />
              <text x={p.x + dx / k} y={p.y + dy / k} fontSize={11 / k} style={{ strokeWidth: 3 / k }}>{p.loc.city.replace(' (Denpasar)', '')}</text>
            </g>
          );
        })}
      </svg>
      <div className="legend">
        <SimBadge text="SIMULATED TOPOLOGY" />
        {topo.providers.map((p: any) => <span key={p.id}><i style={{ background: PROVIDER_COLORS[p.id] }} />{p.name.replace(' (DEMO)', '')}</span>)}
        <span><i style={{ background: '#00b3ff' }} />primary</span>
        <span><i style={{ background: '#a855f7' }} />protection</span>
        <span><i style={{ background: '#f59e0b' }} />reroute</span>
        <span><i style={{ background: 'var(--bad)' }} />down</span>
        <span><i style={{ background: '#16a34a' }} />node hijau = melayani layanan aktif</span>
        <span><i style={{ background: '#1f5f9e' }} />biru = siap, belum ada layanan</span>
        <span>Straight lines are schematic — not cable routes. City positions approximate.</span>
      </div>
    </div>
  );
}
