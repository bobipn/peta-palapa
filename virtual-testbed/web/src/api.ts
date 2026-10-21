export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: any) {
    super(message);
  }
}

function newKey() {
  return `ui-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function api<T = any>(method: string, url: string, body?: unknown, opts: { idempotent?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.idempotent) headers['Idempotency-Key'] = newKey();
  const res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'same-origin' });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const e = data?.error ?? {};
    throw new ApiError(res.status, e.code ?? 'HTTP_' + res.status, e.message ?? res.statusText, e.details);
  }
  return data as T;
}

export const get = <T = any>(url: string) => api<T>('GET', url);
export const post = <T = any>(url: string, body: unknown = {}, idempotent = false) => api<T>('POST', url, body, { idempotent });

// ------------------------------------------------------------------ formatting
export const idr = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : 'Rp ' + Math.round(n).toLocaleString('id-ID');
export const bw = (mbps: number | null | undefined) =>
  mbps === null || mbps === undefined ? '—' : mbps >= 1000 ? `${+(mbps / 1000).toFixed(2)} Gbps` : `${mbps} Mbps`;
export const ms = (v: number | null | undefined, dp = 2) => (v === null || v === undefined ? '—' : `${v.toFixed(dp)} ms`);
export const pct = (v: number | null | undefined, dp = 2) => (v === null || v === undefined ? '—' : `${v.toFixed(dp)} %`);
export const km = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${Math.round(v).toLocaleString('en-US')} km`);
export const dt = (v: string | null | undefined) => (v ? new Date(v).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'medium' }) : '—');
export const segLabel = (id: string) => id.replace(/^seg-/, '').toUpperCase().replace('-', '–');
export const nodeLabel = (id: string) => id.replace(/^nd-/, '').toUpperCase();
