/**
 * SYNTHETIC demo topology.
 *
 * - City coordinates are approximate public city-centre coordinates, used only
 *   to place markers and estimate distances. They are NOT landing-station or
 *   cable-route coordinates.
 * - Every provider, cable system, segment, capacity and price below is FICTIONAL
 *   (NATO-alphabet names, "SIM-" systems). None of it describes a real cable,
 *   operator, tariff or capacity.
 * - Segment length = great-circle distance x route factor (subsea 1.30,
 *   terrestrial 1.25). A crude stand-in for real route length.
 */

export const LOCATIONS = [
  { id: 'jkt', city: 'Jakarta', cc: 'ID', country: 'Indonesia', lat: -6.2088, lon: 106.8456, kind: 'DATA_CENTER' },
  { id: 'btm', city: 'Batam', cc: 'ID', country: 'Indonesia', lat: 1.0456, lon: 104.0305, kind: 'LANDING_STATION' },
  { id: 'sby', city: 'Surabaya', cc: 'ID', country: 'Indonesia', lat: -7.2575, lon: 112.7521, kind: 'POP' },
  { id: 'bal', city: 'Bali (Denpasar)', cc: 'ID', country: 'Indonesia', lat: -8.6705, lon: 115.2126, kind: 'LANDING_STATION' },
  { id: 'mks', city: 'Makassar', cc: 'ID', country: 'Indonesia', lat: -5.1477, lon: 119.4327, kind: 'LANDING_STATION' },
  { id: 'kdi', city: 'Kendari', cc: 'ID', country: 'Indonesia', lat: -3.9985, lon: 122.5129, kind: 'LANDING_STATION' },
  { id: 'bpn', city: 'Balikpapan', cc: 'ID', country: 'Indonesia', lat: -1.2379, lon: 116.8529, kind: 'LANDING_STATION' },
  { id: 'mdo', city: 'Manado', cc: 'ID', country: 'Indonesia', lat: 1.4748, lon: 124.8421, kind: 'LANDING_STATION' },
  { id: 'tte', city: 'Ternate', cc: 'ID', country: 'Indonesia', lat: 0.7893, lon: 127.377, kind: 'LANDING_STATION' },
  { id: 'sin', city: 'Singapore', cc: 'SG', country: 'Singapore', lat: 1.3521, lon: 103.8198, kind: 'DATA_CENTER' },
  { id: 'hkg', city: 'Hong Kong', cc: 'HK', country: 'Hong Kong SAR', lat: 22.3193, lon: 114.1694, kind: 'DATA_CENTER' },
  { id: 'mnl', city: 'Manila', cc: 'PH', country: 'Philippines', lat: 14.5995, lon: 120.9842, kind: 'LANDING_STATION' },
  { id: 'tyo', city: 'Tokyo', cc: 'JP', country: 'Japan', lat: 35.6762, lon: 139.6503, kind: 'DATA_CENTER' },
  { id: 'gum', city: 'Guam', cc: 'GU', country: 'Guam (US)', lat: 13.4443, lon: 144.7937, kind: 'LANDING_STATION' },
  { id: 'hnl', city: 'Honolulu', cc: 'US', country: 'United States', lat: 21.3069, lon: -157.8583, kind: 'LANDING_STATION' },
  { id: 'lax', city: 'Los Angeles', cc: 'US', country: 'United States', lat: 34.0522, lon: -118.2437, kind: 'DATA_CENTER' },
  { id: 'drw', city: 'Darwin', cc: 'AU', country: 'Australia', lat: -12.4634, lon: 130.8456, kind: 'LANDING_STATION' },
  { id: 'per', city: 'Perth', cc: 'AU', country: 'Australia', lat: -31.9523, lon: 115.8613, kind: 'LANDING_STATION' },
  { id: 'syd', city: 'Sydney', cc: 'AU', country: 'Australia', lat: -33.8688, lon: 151.2093, kind: 'DATA_CENTER' },
] as const;

export const PROVIDERS = [
  { id: 'prv-alpha', code: 'ALPHA', name: 'Alpha Nusantara Fiber (DEMO)', autoAccept: true, delayS: 2 },
  { id: 'prv-bravo', code: 'BRAVO', name: 'Bravo Strait Subsea (DEMO)', autoAccept: true, delayS: 2 },
  { id: 'prv-charlie', code: 'CHARLIE', name: 'Charlie Pacific Systems (DEMO)', autoAccept: true, delayS: 3 },
  { id: 'prv-delta', code: 'DELTA', name: 'Delta Austral Networks (DEMO)', autoAccept: false, delayS: 0 },
  { id: 'prv-echo', code: 'ECHO', name: 'Echo Asia Ring (DEMO)', autoAccept: true, delayS: 3 },
] as const;

export const CABLE_SYSTEMS = [
  { id: 'sys-alpha-java', name: 'SIM-JAVA-TERRESTRIAL', provider: 'prv-alpha', kind: 'TERRESTRIAL' },
  { id: 'sys-alpha-sula', name: 'SIM-SULAWESI-RING', provider: 'prv-alpha', kind: 'SUBSEA' },
  { id: 'sys-bravo-strait', name: 'SIM-STRAIT-EXPRESS', provider: 'prv-bravo', kind: 'SUBSEA' },
  { id: 'sys-bravo-kal', name: 'SIM-KALIMANTAN-LINK', provider: 'prv-bravo', kind: 'SUBSEA' },
  { id: 'sys-charlie-pac', name: 'SIM-TRANSPACIFIC', provider: 'prv-charlie', kind: 'SUBSEA' },
  { id: 'sys-delta-aus', name: 'SIM-AUSTRAL-GATEWAY', provider: 'prv-delta', kind: 'SUBSEA' },
  { id: 'sys-delta-land', name: 'SIM-AUSTRAL-LAND', provider: 'prv-delta', kind: 'TERRESTRIAL' },
  { id: 'sys-echo-asia', name: 'SIM-ASIA-RING', provider: 'prv-echo', kind: 'SUBSEA' },
] as const;

/** [a, b, cableSystemId, capacityGbps, pricePerGbpsMonth (IDR, DEMO), srlg?] */
export const SEGMENTS: [string, string, string, number, number, string?][] = [
  // Alpha — domestic
  ['jkt', 'sby', 'sys-alpha-java', 100, 6_000_000, 'JAVA-NORTH-CORRIDOR'],
  ['sby', 'bal', 'sys-alpha-java', 40, 7_000_000],
  ['sby', 'mks', 'sys-alpha-sula', 40, 9_000_000],
  ['mks', 'kdi', 'sys-alpha-sula', 20, 8_000_000],
  ['kdi', 'tte', 'sys-alpha-sula', 10, 11_000_000],
  ['mks', 'mdo', 'sys-alpha-sula', 10, 10_000_000],
  ['mdo', 'tte', 'sys-alpha-sula', 10, 9_000_000],
  ['mks', 'bal', 'sys-alpha-sula', 20, 8_500_000],
  // Bravo — straits & Kalimantan
  ['jkt', 'btm', 'sys-bravo-strait', 100, 7_000_000],
  ['btm', 'sin', 'sys-bravo-strait', 100, 5_000_000],
  ['jkt', 'sin', 'sys-bravo-strait', 40, 10_000_000],
  ['jkt', 'mks', 'sys-bravo-strait', 20, 12_000_000],
  ['sby', 'bpn', 'sys-bravo-kal', 20, 9_500_000],
  ['bpn', 'mdo', 'sys-bravo-kal', 20, 10_500_000],
  // Delta — Australia
  ['bal', 'drw', 'sys-delta-aus', 20, 14_000_000],
  ['drw', 'syd', 'sys-delta-land', 20, 9_000_000],
  ['jkt', 'per', 'sys-delta-aus', 40, 15_000_000],
  ['per', 'syd', 'sys-delta-land', 40, 8_000_000],
  // Echo — intra-Asia
  ['sin', 'hkg', 'sys-echo-asia', 100, 12_000_000],
  ['hkg', 'tyo', 'sys-echo-asia', 100, 12_000_000],
  ['sin', 'mnl', 'sys-echo-asia', 40, 11_000_000],
  ['mnl', 'hkg', 'sys-echo-asia', 40, 9_000_000],
  ['mnl', 'tyo', 'sys-echo-asia', 40, 13_000_000],
  // Charlie — trans-Pacific
  ['tyo', 'lax', 'sys-charlie-pac', 100, 22_000_000],
  ['sin', 'gum', 'sys-charlie-pac', 40, 18_000_000],
  ['tyo', 'gum', 'sys-charlie-pac', 40, 14_000_000],
  ['gum', 'hnl', 'sys-charlie-pac', 40, 16_000_000],
  ['hnl', 'lax', 'sys-charlie-pac', 40, 12_000_000],
  ['syd', 'hnl', 'sys-charlie-pac', 40, 20_000_000],
];

export const PRODUCTS = [
  { id: 'prd-epl', code: 'EPL', name: 'Ethernet Private Line (SIMULATED)', type: 'EPL', min: 100, max: 100_000, desc: 'Point-to-point Ethernet, dedicated bandwidth' },
  { id: 'prd-evpl', code: 'EVPL', name: 'Ethernet Virtual Private Line (SIMULATED)', type: 'EVPL', min: 50, max: 10_000, desc: 'VLAN-based point-to-point Ethernet' },
  { id: 'prd-wave', code: 'WAVE', name: 'Wavelength Service (SIMULATED)', type: 'WAVE', min: 10_000, max: 100_000, desc: 'Dedicated wavelength — optical layer NOT modelled; bandwidth reservation only' },
] as const;

export const SLA_PROFILES = [
  { id: 'sla-domestic', name: 'Domestic Premium (DEMO)', latency: 30, jitter: 2, loss: 0.1, avail: 99.95 },
  { id: 'sla-regional', name: 'Regional Standard (DEMO)', latency: 80, jitter: 5, loss: 0.5, avail: 99.9 },
  { id: 'sla-global', name: 'Global Standard (DEMO)', latency: 150, jitter: 10, loss: 0.5, avail: 99.9 },
] as const;

export const DEFAULT_SETTINGS: Record<string, unknown> = {
  currency: 'IDR',
  platform_fee: {
    rate: 0.1,
    basis: 'GROSS',
    note: 'DEMO configuration. GROSS = fee is rate x customer price; WHOLESALE = fee is rate x sum of provider wholesale. The commercial basis has NOT been agreed.',
  },
  tax: { rate: 0, label: 'PPN', note: 'Disabled in demo. Rate and tax base require verification by tax/finance before use.' },
  quote_validity_hours: 168,
  payment_timeout_minutes: 30,
  provider_acceptance_timeout_minutes: 10,
  hold_ttl_minutes: 30,
  provisioning_delay_s_per_node: 2,
  protection_revertive: false,
  protection_switch_ms: 50,
  reroute_ticks: 2,
  node_processing_ms: 0.05,
};

export const SIMULATION_DEFAULTS = { seed: 20261021, epoch: '2026-10-01T00:00:00Z', tickSeconds: 60 };

/** Built-in fault scenarios. `steps` are applied together as one correlated group. */
export const SCENARIOS = [
  { code: 'FIBER_CUT_JKT_MKS', name: 'Fiber cut Jakarta–Makassar', description: 'Cuts SIM-STRAIT-EXPRESS span JKT–MKS.', steps: [{ type: 'FIBER_CUT', targetType: 'SEGMENT', targetId: 'seg-jkt-mks' }] },
  { code: 'NODE_DOWN_MKS', name: 'PoP down Makassar', description: 'Takes the Makassar node down; every span touching it fails.', steps: [{ type: 'NODE_DOWN', targetType: 'NODE', targetId: 'nd-mks' }] },
  { code: 'PORT_DOWN_TTE', name: 'Port down at Ternate (KDI–TTE)', description: 'Line port facing Kendari at Ternate goes down.', steps: [{ type: 'PORT_DOWN', targetType: 'PORT', targetId: 'pt-tte-seg-kdi-tte' }] },
  { code: 'CAPACITY_EXHAUSTION_KDI_TTE', name: 'Capacity exhaustion KDI–TTE', description: 'Synthetic traffic consumes remaining capacity; new orders cannot use the span and congestion raises loss.', steps: [{ type: 'CAPACITY_EXHAUSTION', targetType: 'SEGMENT', targetId: 'seg-kdi-tte' }] },
  { code: 'HIGH_LATENCY_SBY_MKS', name: 'High latency Surabaya–Makassar', description: '+40 ms on SBY–MKS.', steps: [{ type: 'HIGH_LATENCY', targetType: 'SEGMENT', targetId: 'seg-sby-mks', params: { addMs: 40 } }] },
  { code: 'LATENCY_BREACH_JKT_MKS', name: 'Latency above SLA Jakarta–Makassar', description: '+25 ms on JKT–MKS (breaches a 30 ms domestic SLA).', steps: [{ type: 'HIGH_LATENCY', targetType: 'SEGMENT', targetId: 'seg-jkt-mks', params: { addMs: 25 } }] },
  { code: 'PACKET_LOSS_JKT_SIN', name: 'Packet loss Jakarta–Singapore', description: '+1.5 % loss on JKT–SIN direct.', steps: [{ type: 'PACKET_LOSS', targetType: 'SEGMENT', targetId: 'seg-jkt-sin', params: { addPct: 1.5 } }] },
  { code: 'PROVIDER_API_TIMEOUT_BRAVO', name: 'Provider API timeout (Bravo)', description: 'Bravo order interface stops responding; acceptance and provisioning calls time out.', steps: [{ type: 'PROVIDER_API_TIMEOUT', targetType: 'PROVIDER', targetId: 'prv-bravo' }] },
  { code: 'PROVISIONING_FAILURE_ALPHA', name: 'Provisioning failure (Alpha)', description: 'Virtual provisioning on Alpha spans fails while active.', steps: [{ type: 'PROVISIONING_FAILURE', targetType: 'PROVIDER', targetId: 'prv-alpha' }] },
  { code: 'PRIMARY_FAILURE_TYO_LAX', name: 'Primary route failure with protection (TYO–LAX)', description: 'Cuts the trans-Pacific TYO–LAX span; protected services switch to their standby path.', steps: [{ type: 'FIBER_CUT', targetType: 'SEGMENT', targetId: 'seg-tyo-lax' }] },
  { code: 'CORRELATED_SULAWESI', name: 'Correlated failures — Sulawesi event', description: 'Simultaneous cuts JKT–MKS, SBY–MKS and MKS–BAL (e.g. one seabed event).', steps: [
    { type: 'FIBER_CUT', targetType: 'SEGMENT', targetId: 'seg-jkt-mks' },
    { type: 'FIBER_CUT', targetType: 'SEGMENT', targetId: 'seg-sby-mks' },
    { type: 'FIBER_CUT', targetType: 'SEGMENT', targetId: 'seg-mks-bal' },
  ] },
  { code: 'MAINTENANCE_BTM_SIN', name: 'Scheduled maintenance BTM–SIN', description: 'Planned work on BTM–SIN; outage time is excluded from availability.', steps: [{ type: 'SCHEDULED_MAINTENANCE', targetType: 'SEGMENT', targetId: 'seg-btm-sin' }] },
];

export const DEMO_USERS = [
  { id: 'usr-admin', email: 'admin@demo.local', name: 'Platform Admin (DEMO)', role: 'ADMIN', org: 'org-platform' },
  { id: 'usr-noc', email: 'noc@demo.local', name: 'NOC Engineer (DEMO)', role: 'NOC', org: 'org-platform' },
  { id: 'usr-commercial', email: 'commercial@demo.local', name: 'Commercial Ops (DEMO)', role: 'COMMERCIAL', org: 'org-platform' },
  { id: 'usr-auditor', email: 'auditor@demo.local', name: 'Auditor (DEMO, read-only)', role: 'AUDITOR', org: 'org-platform' },
  { id: 'usr-cust-a', email: 'customer.a@demo.local', name: 'Buyer — PT Contoh Satu (DEMO)', role: 'CUSTOMER', org: 'org-cust-a' },
  { id: 'usr-cust-b', email: 'customer.b@demo.local', name: 'Buyer — Example Two Ltd (DEMO)', role: 'CUSTOMER', org: 'org-cust-b' },
  { id: 'usr-alpha', email: 'alpha@demo.local', name: 'Alpha Nusantara Fiber ops (DEMO)', role: 'PROVIDER', org: 'org-prv-alpha' },
  { id: 'usr-bravo', email: 'bravo@demo.local', name: 'Bravo Strait Subsea ops (DEMO)', role: 'PROVIDER', org: 'org-prv-bravo' },
  { id: 'usr-charlie', email: 'charlie@demo.local', name: 'Charlie Pacific ops (DEMO)', role: 'PROVIDER', org: 'org-prv-charlie' },
  { id: 'usr-delta', email: 'delta@demo.local', name: 'Delta Austral ops (DEMO)', role: 'PROVIDER', org: 'org-prv-delta' },
  { id: 'usr-echo', email: 'echo@demo.local', name: 'Echo Asia Ring ops (DEMO)', role: 'PROVIDER', org: 'org-prv-echo' },
] as const;

export const CUSTOMERS = [
  { id: 'cus-a', org: 'org-cust-a', name: 'PT Contoh Satu (DEMO)' },
  { id: 'cus-b', org: 'org-cust-b', name: 'Example Two Ltd (DEMO)' },
] as const;
