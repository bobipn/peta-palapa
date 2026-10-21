import { useState, type FormEvent } from 'react';
import { post } from '../api';
import { ErrorBox, SimBadge, useAction } from '../components/ui';
import type { User } from '../App';

const DEMO = [
  ['customer.a@demo.local', 'Customer A (buyer)'],
  ['customer.b@demo.local', 'Customer B (buyer)'],
  ['alpha@demo.local', 'Cable owner — Alpha (auto-accept)'],
  ['delta@demo.local', 'Cable owner — Delta (manual accept)'],
  ['noc@demo.local', 'NOC engineer'],
  ['commercial@demo.local', 'Commercial operations'],
  ['auditor@demo.local', 'Auditor (read-only)'],
  ['admin@demo.local', 'Platform administrator'],
];

export function LoginPage({ onLogin }: { onLogin: (u: User) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { busy, error, run } = useAction();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const r = await run(() => post<{ user: User }>('/api/auth/login', { email, password }));
    if (r) onLogin(r.user);
  };
  return (
    <div className="login">
      <div className="card stack">
        <div>
          <div className="row between"><h1>C-Ring Virtual Testbed</h1><SimBadge /></div>
          <div className="muted small">Digital twin of a connectivity marketplace and its network. Every provider, cable and metric here is synthetic.</div>
        </div>
        <form className="stack" onSubmit={submit}>
          <label className="f">Email<input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label className="f">Password<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
          <ErrorBox error={error} />
          <button className="primary" disabled={busy} type="submit">{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <details>
          <summary className="small muted">Demo accounts (password is set by the operator via DEMO_PASSWORD)</summary>
          <div className="stack demo-users" style={{ gap: 6, marginTop: 8 }}>
            {DEMO.map(([e, l]) => (
              <button type="button" key={e} className="sm ghost" onClick={() => setEmail(e)}>
                <span className="mono">{e}</span><span className="muted"> — {l}</span>
              </button>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}
