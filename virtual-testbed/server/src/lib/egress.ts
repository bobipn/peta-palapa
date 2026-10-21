/**
 * Default-deny egress guard. Wraps globalThis.fetch so that any outbound HTTP
 * call to a host not on the allowlist fails loudly. The simulator and mock
 * adapters never need the network; this makes an accidental "real" call to a
 * provider API impossible through fetch.
 *
 * Limitation: code that uses node:http / node:net directly is not covered.
 * The application itself does not; the Postgres driver uses node:net to reach
 * DATABASE_URL, which is intentional.
 */
let installed = false;

export function installEgressGuard(allowlist: string[]) {
  if (installed) return;
  installed = true;
  const original = globalThis.fetch;
  const allowed = new Set(['localhost', '127.0.0.1', '::1', ...allowlist]);
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    if (!allowed.has(url.hostname)) {
      throw new Error(`EGRESS_DENIED: outbound call to ${url.hostname} blocked (simulation environment, default-deny)`);
    }
    return original(input, init);
  }) as typeof fetch;
}

export function isEgressGuardInstalled() {
  return installed;
}
