/**
 * Packet-Tracer-style network device glyph (router/OTN cylinder with arrows,
 * status LED and signal rings). Drawn in a local ~40x32 unit box centred on
 * (0,0); place it with `x`, `y` and `scale` inside any <svg>.
 */
export type DeviceState = 'PENDING' | 'BOOTING' | 'CONFIGURED' | 'TESTING' | 'ACTIVE' | 'STANDBY' | 'DOWN' | 'OFF' | 'IDLE';

export const DEVICE_STYLE: Record<DeviceState, { body: string; top: string; led: string; label: string; blink?: boolean; signal?: boolean }> = {
  PENDING: { body: '#b4232c', top: '#e05a62', led: '#ff3b3b', label: 'BELUM AKTIF' },
  BOOTING: { body: '#b26a00', top: '#f0a42a', led: '#ffb020', label: 'BOOTING', blink: true },
  CONFIGURED: { body: '#2f7d32', top: '#7cc47f', led: '#b6f26b', label: 'KONFIGURASI OK' },
  TESTING: { body: '#0e6e8c', top: '#4fb6d6', led: '#33d1ff', label: 'TESTING', blink: true },
  ACTIVE: { body: '#12813a', top: '#3fca6b', led: '#22ff6a', label: 'AKTIF', signal: true },
  STANDBY: { body: '#2d6a4f', top: '#74b49b', led: '#22ff6a', label: 'STANDBY' },
  DOWN: { body: '#7f1d1d', top: '#dc2626', led: '#ff1f1f', label: 'DOWN', blink: true },
  OFF: { body: '#4b5563', top: '#9ca3af', led: '#374151', label: 'OFF' },
  IDLE: { body: '#1f5f9e', top: '#5b9bd5', led: '#22ff6a', label: 'IDLE' },
};

export function DeviceGlyph({ x, y, scale = 1, state, title, onClick, selected }: {
  x: number; y: number; scale?: number; state: DeviceState; title?: string; onClick?: () => void; selected?: boolean;
}) {
  const s = DEVICE_STYLE[state];
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} onClick={onClick} style={{ cursor: onClick ? 'pointer' : undefined }} className="device">
      {title ? <title>{title}</title> : null}
      {s.signal ? (
        <>
          <circle r="16" fill="none" stroke={s.led} strokeWidth="1.5" opacity="0">
            <animate attributeName="r" values="16;30" dur="1.8s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.8;0" dur="1.8s" repeatCount="indefinite" />
          </circle>
          <circle r="16" fill="none" stroke={s.led} strokeWidth="1.5" opacity="0">
            <animate attributeName="r" values="16;30" dur="1.8s" begin="0.9s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.8;0" dur="1.8s" begin="0.9s" repeatCount="indefinite" />
          </circle>
        </>
      ) : null}
      {selected ? <ellipse cx="0" cy="2" rx="24" ry="15" fill="none" stroke="var(--text)" strokeWidth="1.5" strokeDasharray="3 2" /> : null}
      {/* cylinder body */}
      <path d="M-18,-5 v12 a18,6 0 0 0 36,0 v-12 Z" fill={s.body} stroke="#0b1220" strokeWidth="0.8" />
      <ellipse cx="0" cy="-5" rx="18" ry="6" fill={s.top} stroke="#0b1220" strokeWidth="0.8" />
      {/* Cisco-style router arrows on the lid */}
      <g stroke="#fff" strokeWidth="1.4" fill="#fff" strokeLinecap="round">
        <line x1="-13" y1="-5" x2="-4" y2="-5" /><path d="M-4,-7 L-1.5,-5 L-4,-3 Z" />
        <line x1="13" y1="-5" x2="4" y2="-5" /><path d="M4,-7 L1.5,-5 L4,-3 Z" />
        <line x1="-2" y1="-9.5" x2="-6" y2="-10.5" /><line x1="2" y1="-0.5" x2="6" y2="0.5" />
      </g>
      {/* status LED */}
      <circle cx="12" cy="5" r="2.6" fill={s.led} stroke="#0b1220" strokeWidth="0.6">
        {s.blink ? <animate attributeName="opacity" values="1;0.15;1" dur="0.9s" repeatCount="indefinite" /> : null}
      </circle>
      <circle cx="5" cy="6" r="1.4" fill={state === 'OFF' || state === 'PENDING' ? '#374151' : '#9ae6b4'} />
      {state === 'DOWN' ? <path d="M-10,-10 L10,10 M10,-10 L-10,10" stroke="#fff" strokeWidth="3" strokeLinecap="round" /> : null}
    </g>
  );
}

/** Small standalone icon for tables/legends. */
export function DeviceBadge({ state, size = 34 }: { state: DeviceState; size?: number }) {
  return (
    <svg width={size} height={size * 0.8} viewBox="-22 -18 44 35" aria-label={DEVICE_STYLE[state].label} role="img" style={{ verticalAlign: 'middle', width: size, height: size * 0.8, flex: 'none' }} className="device-badge">
      <DeviceGlyph x={0} y={0} state={state} />
    </svg>
  );
}
