import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { BrowserRouter, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { get, post } from './api';
import { SimBadge } from './components/ui';
import { LoginPage } from './pages/Login';
import { OverviewPage } from './pages/Overview';
import { MarketplacePage } from './pages/Marketplace';
import { TopologyPage } from './pages/Topology';
import { CableOwnersPage } from './pages/CableOwners';
import { OrderDetailPage, OrdersPage } from './pages/Orders';
import { ServiceDetailPage, ServicesPage } from './pages/Services';
import { ProvisioningPage, WorkflowDetailPage } from './pages/Provisioning';
import { SlaPage } from './pages/Sla';
import { AlarmsPage, IncidentDetailPage } from './pages/Alarms';
import { SimulationLabPage } from './pages/SimulationLab';
import { SettlementPage } from './pages/Settlement';
import { AuditPage } from './pages/Audit';
import { SettingsPage } from './pages/Settings';
import { DeviceMapPage } from './pages/DeviceMap';
import { PerformancePage } from './pages/Performance';
import { DeviceDetailPage, IpamPage } from './pages/Devices';

export type Role = 'ADMIN' | 'CUSTOMER' | 'PROVIDER' | 'NOC' | 'COMMERCIAL' | 'AUDITOR';
export interface User { userId: string; email: string; displayName: string; role: Role; customerId: string | null; providerId: string | null }

const AuthCtx = createContext<{ user: User; logout: () => void } | null>(null);
export const useAuth = () => useContext(AuthCtx)!;
export const hasRole = (u: User, ...roles: Role[]) => roles.includes(u.role);

const ALL: Role[] = ['ADMIN', 'CUSTOMER', 'PROVIDER', 'NOC', 'COMMERCIAL', 'AUDITOR'];
const MENU: { path: string; label: string; roles: Role[] }[] = [
  { path: '/', label: 'Overview', roles: ALL },
  { path: '/marketplace', label: 'Marketplace', roles: ['CUSTOMER'] },
  { path: '/routes', label: 'Route Explorer', roles: ['ADMIN', 'NOC', 'COMMERCIAL'] },
  { path: '/topology', label: 'Network Topology', roles: ['ADMIN', 'NOC', 'AUDITOR', 'PROVIDER', 'COMMERCIAL'] },
  { path: '/owners', label: 'Cable Owners', roles: ['PROVIDER', 'ADMIN', 'NOC', 'COMMERCIAL', 'AUDITOR'] },
  { path: '/orders', label: 'Orders', roles: ALL },
  { path: '/services', label: 'Services', roles: ALL },
  { path: '/provisioning', label: 'Provisioning', roles: ['ADMIN', 'NOC', 'AUDITOR'] },
  { path: '/sla', label: 'SLA & Monitoring', roles: ['ADMIN', 'NOC', 'AUDITOR', 'PROVIDER', 'CUSTOMER'] },
  { path: '/alarms', label: 'Alarms & Incidents', roles: ['ADMIN', 'NOC', 'AUDITOR', 'PROVIDER', 'CUSTOMER'] },
  { path: '/device-map', label: 'Device Map', roles: ['ADMIN', 'NOC', 'AUDITOR'] },
  { path: '/performance', label: 'Performance', roles: ['ADMIN', 'NOC', 'AUDITOR'] },
  { path: '/ipam', label: 'IPAM & VLAN', roles: ['ADMIN', 'NOC', 'AUDITOR'] },
  { path: '/simulation', label: 'Simulation Lab', roles: ['ADMIN', 'NOC', 'AUDITOR'] },
  { path: '/settlement', label: 'Revenue & Settlement', roles: ['ADMIN', 'COMMERCIAL', 'AUDITOR', 'PROVIDER'] },
  { path: '/audit', label: 'Audit Logs', roles: ['ADMIN', 'AUDITOR'] },
  { path: '/settings', label: 'Settings', roles: ['ADMIN', 'COMMERCIAL', 'AUDITOR', 'NOC'] },
];

function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  const [theme, setTheme] = useState<string>(() => { try { return localStorage.getItem('theme') ?? ''; } catch { return ''; } });
  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme; else delete document.documentElement.dataset.theme;
    try { localStorage.setItem('theme', theme); } catch { /* storage unavailable */ }
  }, [theme]);
  return (
    <div className="shell">
      <aside className={`side ${open ? 'open' : ''}`} aria-label="Main navigation">
        <div className="brand">
          <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden><circle cx="16" cy="16" r="12" fill="none" stroke="#1FA2FF" strokeWidth="4" /><circle cx="16" cy="16" r="4" fill="#10B981" /></svg>
          <div>C-Ring Virtual Testbed<small>Digital twin · SIMULATED</small></div>
        </div>
        <nav className="nav">
          {MENU.filter((m) => m.roles.includes(user.role)).map((m) => (
            <NavLink key={m.path} to={m.path} end={m.path === '/'}>{m.label}</NavLink>
          ))}
        </nav>
      </aside>
      <div className="main">
        <div className="disclaimer">
          SIMULATION ENVIRONMENT — all providers, cables, capacities, prices, payments and metrics are synthetic. Nothing here is connected to a real network, provider, billing or payment system.
        </div>
        <header className="topbar">
          <button className="menu-btn ghost" onClick={() => setOpen(!open)} aria-label="Toggle menu">☰</button>
          <SimBadge />
          <div className="spacer" />
          <span className="small muted">{user.displayName}</span>
          <span className="badge b-accent">{user.role}</span>
          <button className="sm ghost" onClick={() => setTheme(theme === 'dark' ? 'light' : theme === 'light' ? '' : 'dark')} title="Theme: auto / dark / light">Theme: {theme || 'auto'}</button>
          <button className="sm" onClick={logout}>Logout</button>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}

function Guard({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  if (!roles.includes(user.role)) return <div className="alert warn">Your role ({user.role}) cannot open this page. The backend enforces the same rule.</div>;
  return <>{children}</>;
}

export function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => {
    get<{ user: User }>('/api/auth/me').then((r) => setUser(r.user), () => setUser(null));
  }, []);
  const logout = async () => {
    await post('/api/auth/logout').catch(() => undefined);
    setUser(null);
  };
  if (user === undefined) return <div className="empty">Loading…</div>;
  if (user === null) return <LoginPage onLogin={setUser} />;
  const r = (path: string) => MENU.find((m) => m.path === path)!.roles;
  return (
    <AuthCtx.Provider value={{ user, logout }}>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/marketplace" element={<Guard roles={r('/marketplace')}><MarketplacePage mode="customer" /></Guard>} />
            <Route path="/routes" element={<Guard roles={r('/routes')}><MarketplacePage mode="explorer" /></Guard>} />
            <Route path="/topology" element={<Guard roles={r('/topology')}><TopologyPage /></Guard>} />
            <Route path="/owners" element={<Guard roles={r('/owners')}><CableOwnersPage /></Guard>} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/orders/:id" element={<OrderDetailPage />} />
            <Route path="/services" element={<ServicesPage />} />
            <Route path="/services/:id" element={<ServiceDetailPage />} />
            <Route path="/provisioning" element={<Guard roles={r('/provisioning')}><ProvisioningPage /></Guard>} />
            <Route path="/provisioning/:id" element={<Guard roles={r('/provisioning')}><WorkflowDetailPage /></Guard>} />
            <Route path="/sla" element={<Guard roles={r('/sla')}><SlaPage /></Guard>} />
            <Route path="/alarms" element={<Guard roles={r('/alarms')}><AlarmsPage /></Guard>} />
            <Route path="/incidents/:id" element={<Guard roles={r('/alarms')}><IncidentDetailPage /></Guard>} />
            <Route path="/device-map" element={<Guard roles={r('/device-map')}><DeviceMapPage /></Guard>} />
            <Route path="/performance" element={<Guard roles={r('/performance')}><PerformancePage /></Guard>} />
            <Route path="/ipam" element={<Guard roles={r('/ipam')}><IpamPage /></Guard>} />
            <Route path="/devices/:id" element={<Guard roles={r('/device-map')}><DeviceDetailPage /></Guard>} />
            <Route path="/simulation" element={<Guard roles={r('/simulation')}><SimulationLabPage /></Guard>} />
            <Route path="/settlement" element={<Guard roles={r('/settlement')}><SettlementPage /></Guard>} />
            <Route path="/audit" element={<Guard roles={r('/audit')}><AuditPage /></Guard>} />
            <Route path="/settings" element={<Guard roles={r('/settings')}><SettingsPage /></Guard>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </AuthCtx.Provider>
  );
}
