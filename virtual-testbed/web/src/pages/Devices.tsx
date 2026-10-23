import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { get, post } from '../api';
import { hasRole, useAuth } from '../App';
import { Badge, Bar, Empty, ErrorBox, Kpi, Loading, PageHead, SimBadge, Tabs, useAction, useApi } from '../components/ui';
import { DeviceGraphs } from './Performance';

const mb = (v: number | null | undefined) => (v === null || v === undefined ? '—' : v >= 1000 ? `${(v / 1000).toFixed(2)} Gb/s` : `${v.toFixed(1)} Mb/s`);

export function DeviceDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const canControl = hasRole(user, 'ADMIN', 'NOC');
  const d = useApi(() => get(`/api/devices/${id}`), [id], 5000);
  const [tab, setTab] = useState('Interfaces');
  const act = useAction();
  if (d.error) return <ErrorBox error={d.error} />;
  if (!d.data) return <Loading />;
  const { device: dev, ports, vlans, services, alarms, runningConfig } = d.data;
  const admin = (portId: string, name: string, status: 'UP' | 'DOWN') => act.run(async () => {
    if (status === 'DOWN' && !confirm(`shutdown ${name} pada ${dev.hostname}? (simulasi — layanan yang memakai port ini akan down)`)) return;
    await post(`/api/devices/${dev.id}/ports/${portId}/admin`, { status });
    d.reload();
  });
  return (
    <div className="stack">
      <PageHead title={dev.hostname} sub={<>{dev.model} · {dev.os_version} · S/N {dev.serial} · {dev.city} <SimBadge /></>}>
        {dev.reachable === false ? <Badge v="DOWN" /> : <Badge v="UP" />}
        <Link className="btn" to="/device-map">← Device map</Link>
      </PageHead>
      <ErrorBox error={act.error} />
      <div className="kpis">
        <Kpi label="Mgmt IP" value={<span className="mono" style={{ fontSize: 16 }}>{dev.mgmt_ip}</span>} sub={dev.loopback_ip ? `loopback ${dev.loopback_ip}` : dev.role} />
        <Kpi label="Ping RTT (NMS)" value={dev.ping_ms !== null && dev.ping_ms !== undefined ? `${dev.ping_ms.toFixed(2)} ms` : '—'} sub={`loss ${dev.ping_loss_pct ?? '—'} %`} tone={dev.reachable === false ? 'bad' : undefined} />
        <Kpi label="CPU / Memori" value={dev.cpu_pct !== null && dev.cpu_pct !== undefined ? `${dev.cpu_pct.toFixed(0)} % / ${dev.mem_pct.toFixed(0)} %` : '—'} />
        <Kpi label="Interface" value={ports.length} sub={`${ports.filter((p: any) => p.oper_status === 'DOWN').length} down`} tone={ports.some((p: any) => p.oper_status === 'DOWN') ? 'warn' : undefined} />
        <Kpi label="Layanan" value={services.length} />
        <Kpi label="Alarm aktif" value={alarms.filter((a: any) => a.state === 'ACTIVE').length} tone={alarms.some((a: any) => a.state === 'ACTIVE') ? 'bad' : undefined} />
      </div>
      <Tabs tabs={['Interfaces', 'VLAN', 'Services', 'Alarms', 'Running config', 'Graphs']} value={tab} onChange={setTab} />

      {tab === 'Interfaces' ? (
        <div className="card table-wrap"><table>
          <thead><tr><th>Interface</th><th>Jenis</th><th>Admin</th><th>Oper</th><th className="num">Speed</th><th>IP</th><th>VLAN</th><th>Deskripsi</th><th className="num">rx</th><th className="num">tx</th><th style={{ width: 110 }}>Load</th>{canControl ? <th>Aksi</th> : null}</tr></thead>
          <tbody>{ports.map((p: any) => (
            <tr key={p.id}>
              <td className="mono">{p.name}</td><td className="small">{p.kind}<div className="muted">{p.mode}</div></td>
              <td><Badge v={p.admin_status} /></td><td><Badge v={p.oper_status} /></td>
              <td className="num">{p.speed_mbps ? mb(p.speed_mbps) : '—'}</td>
              <td className="mono small">{p.ip_address ?? '—'}</td><td className="mono small">{p.vlans ?? (p.kind === 'MGMT' && dev.role !== 'OTN' ? '99' : '—')}</td>
              <td className="small">{p.description}{p.service_id ? <div><Link to={`/services/${p.service_id}`}>{p.service_id}</Link></div> : null}</td>
              <td className="num">{mb(p.in_mbps)}</td><td className="num">{mb(p.out_mbps)}</td>
              <td>{p.speed_mbps ? <Bar value={Math.max(p.in_mbps ?? 0, p.out_mbps ?? 0)} max={p.speed_mbps} /> : null}</td>
              {canControl ? <td>{['LOOPBACK', 'SVI'].includes(p.kind) ? null : p.admin_status === 'DOWN'
                ? <button className="sm" onClick={() => admin(p.id, p.name, 'UP')} disabled={act.busy}>no shutdown</button>
                : <button className="sm danger" onClick={() => admin(p.id, p.name, 'DOWN')} disabled={act.busy}>shutdown</button>}</td> : null}
            </tr>
          ))}</tbody>
        </table>
        <div className="small muted" style={{ marginTop: 6 }}>shutdown dimodelkan sebagai fault PORT_DOWN: memicu alarm, insiden, dan dampak ke layanan yang memakai port tersebut. Semua SIMULASI.</div></div>
      ) : null}

      {tab === 'VLAN' ? (
        <div className="card table-wrap">{vlans.length ? <table>
          <thead><tr><th className="num">VLAN</th><th>Jenis</th><th>Interface</th><th>Layanan</th><th>Keterangan</th></tr></thead>
          <tbody>{vlans.map((v: any) => <tr key={v.id}><td className="num mono">{v.vlan_id}</td><td><Badge v={v.kind} tone={v.kind === 'MGMT' ? 'neutral' : 'accent'} /></td><td className="mono small">{v.port_name ?? '—'}</td>
            <td>{v.service_id ? <Link to={`/services/${v.service_id}`}>{v.service_name}</Link> : '—'}</td><td className="small">{v.description}</td></tr>)}</tbody>
        </table> : <Empty>Perangkat OTN tidak memakai VLAN (transport optik).</Empty>}</div>
      ) : null}

      {tab === 'Services' ? (
        <div className="card table-wrap">{services.length ? <table>
          <thead><tr><th>Layanan</th><th>Peran perangkat</th><th>Jalur</th><th>State</th><th>Oper</th></tr></thead>
          <tbody>{services.map((s: any) => <tr key={s.id + s.role + s.path_role}><td><Link to={`/services/${s.id}`}>{s.name}</Link></td><td>{s.role}</td><td>{s.path_role}</td><td><Badge v={s.state} /></td><td><Badge v={s.oper_status} /></td></tr>)}</tbody>
        </table> : <Empty>Belum ada layanan di perangkat ini.</Empty>}</div>
      ) : null}

      {tab === 'Alarms' ? (
        <div className="card table-wrap">{alarms.length ? <table>
          <thead><tr><th>Severity</th><th className="num">Kode</th><th>Nama</th><th>Lokasi</th><th>State</th><th>Tick</th></tr></thead>
          <tbody>{alarms.map((a: any) => <tr key={a.id}><td><span className={`sev sev-${a.severity}`}>{a.severity}</span></td><td className="num">{a.code}</td><td className="mono small">{a.type}</td><td className="small">{a.location_info}</td><td><Badge v={a.state} /></td><td className="small">{a.raised_tick}{a.cleared_tick !== null ? `→${a.cleared_tick}` : ''}</td></tr>)}</tbody>
        </table> : <Empty>Tidak ada alarm.</Empty>}</div>
      ) : null}

      {tab === 'Running config' ? (
        <div className="card"><div className="row between" style={{ marginBottom: 6 }}><span className="small muted">Pseudo-CLI ilustratif, tidak valid untuk perangkat nyata.</span>
          <button className="sm" onClick={() => navigator.clipboard?.writeText(runningConfig)}>Salin</button></div><pre style={{ maxHeight: 560 }}>{runningConfig}</pre></div>
      ) : null}

      {tab === 'Graphs' ? <DeviceGraphs deviceId={dev.id} /> : null}
    </div>
  );
}

export function IpamPage() {
  const ip = useApi(() => get('/api/ipam'), [], 10000);
  const vl = useApi(() => get('/api/vlans'), [], 10000);
  const [tab, setTab] = useState('IP address');
  const [q, setQ] = useState('');
  const [showReleased, setShowReleased] = useState(false);
  const f = q.toLowerCase();
  const match = (o: any) => (!f || JSON.stringify(o).toLowerCase().includes(f)) && (showReleased || o.status !== 'RELEASED');
  return (
    <div className="stack">
      <PageHead title="IPAM & VLAN" sub="Rencana alamat IP dan alokasi VLAN — semua SIMULASI (rentang privat, bukan rencana operator riil)."><SimBadge /></PageHead>
      <ErrorBox error={ip.error ?? vl.error} />
      {ip.data ? (
        <div className="grid g3">{ip.data.pools.map((p: any) => (
          <div key={p.id} className="card"><div className="row between"><strong>{p.name}</strong><Badge v={p.purpose} tone="accent" /></div>
            <div className="mono" style={{ fontSize: 18, margin: '6px 0' }}>{p.cidr}</div>
            <Bar value={p.utilisation} /><div className="small muted">{p.used} / {p.capacity} blok /{p.prefix_len} terpakai ({(p.utilisation * 100).toFixed(1)} %)</div></div>
        ))}</div>
      ) : <Loading />}
      <div className="card">
        <div className="row between">
          <Tabs tabs={['IP address', 'VLAN']} value={tab} onChange={setTab} />
          <div className="row"><input placeholder="Filter (IP, VLAN, hostname, layanan)…" value={q} onChange={(e) => setQ(e.target.value)} />
            <label className="small row" style={{ gap: 4 }}><input type="checkbox" checked={showReleased} onChange={(e) => setShowReleased(e.target.checked)} /> tampilkan yang dilepas</label></div>
        </div>
        {tab === 'IP address' ? (ip.data ? <div className="table-wrap"><table>
          <thead><tr><th>Alamat</th><th>Pool</th><th>Dipakai oleh</th><th>Keterangan</th><th>Status</th></tr></thead>
          <tbody>{ip.data.allocations.filter(match).map((a: any) => <tr key={a.id}><td className="mono">{a.address}</td><td className="small">{a.pool_id}</td>
            <td className="small">{a.assigned_type === 'SERVICE' ? <Link to={`/services/${a.assigned_id}`}>{a.assigned_name ?? a.assigned_id}</Link> : <Link to={`/devices/${a.assigned_id}`}>{a.assigned_name}</Link>}</td>
            <td className="small">{a.description}</td><td><Badge v={a.status === 'ALLOCATED' ? 'ACTIVE' : 'RELEASED'} /></td></tr>)}</tbody>
        </table></div> : <Loading />) : (vl.data ? <div className="table-wrap"><table>
          <thead><tr><th className="num">VLAN</th><th>Jenis</th><th>Perangkat</th><th>Interface</th><th>Lokasi</th><th>Layanan</th><th>Status</th></tr></thead>
          <tbody>{vl.data.filter(match).map((v: any) => <tr key={v.id}><td className="num mono">{v.vlan_id}</td><td><Badge v={v.kind} tone={v.kind === 'MGMT' ? 'neutral' : 'accent'} /></td>
            <td className="mono small"><Link to={`/devices/${v.equipment_id}`}>{v.hostname}</Link></td><td className="mono small">{v.port_name ?? '—'}</td><td>{v.city}</td>
            <td>{v.service_id ? <Link to={`/services/${v.service_id}`}>{v.service_name}</Link> : '—'}</td><td><Badge v={v.status === 'ALLOCATED' ? 'ACTIVE' : 'RELEASED'} /></td></tr>)}</tbody>
        </table></div> : <Loading />)}
        <div className="small muted" style={{ marginTop: 6 }}>S-VLAN 1001–3999 dialokasikan otomatis per layanan (unik per PE, sama di kedua ujung); VLAN 99 = manajemen. Indeks unik di database mencegah alokasi ganda.</div>
      </div>
    </div>
  );
}

/** Network config tab for the service page (customer sees handoff only). */
export function ServiceNetworkTab({ serviceId }: { serviceId: string }) {
  const n = useApi(() => get(`/api/services/${serviceId}/network`), [serviceId]);
  if (n.error) return <ErrorBox error={n.error} />;
  if (!n.data) return <Loading />;
  const d = n.data;
  return (
    <div className="stack">
      <div className="card">
        <h2>Customer handoff <SimBadge /></h2>
        {d.handoff.length ? <table>
          <thead><tr><th>Ujung</th><th>Perangkat</th><th>Port (UNI)</th><th className="num">S-VLAN</th><th>C-VLAN</th><th className="num">MTU</th></tr></thead>
          <tbody>{d.handoff.map((h: any) => <tr key={h.end}><td><strong>{h.end}</strong></td><td className="mono">{h.device}</td><td className="mono">{h.port}</td><td className="num mono">{h.sVlan ?? '—'}</td><td className="mono">{h.cVlan ?? '—'}</td><td className="num">{h.mtu}</td></tr>)}</tbody>
        </table> : <Empty>Belum dikonfigurasi (dibuat saat langkah CONFIGURE_SERVICE).</Empty>}
        {d.testSubnet ? <div className="small" style={{ marginTop: 8 }}>Subnet uji CE: <span className="mono">{d.testSubnet}</span> — {d.testIps}</div> : null}
        <div className="small muted">{d.note}</div>
      </div>
      {d.configs.length ? (
        <div className="card"><h2>Konfigurasi per perangkat</h2>
          {d.configs.map((c: any) => (
            <details key={c.id} open={c.role !== 'TRANSIT'}>
              <summary><span className="mono">{c.hostname}</span> · {c.role} · {c.path_role} · <Badge v={c.status === 'APPLIED' ? 'ACTIVE' : 'RELEASED'} /></summary>
              <pre>{c.rendered_config}</pre>
            </details>
          ))}
        </div>
      ) : null}
    </div>
  );
}
