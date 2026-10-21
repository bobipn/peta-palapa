/**
 * Boundary between orchestration and whatever emulates the network.
 *
 * Mode A (DeterministicSimulationAdapter) is the MVP and always available.
 * Mode B adapters (Containerlab, Mininet-Optical) are optional, detected at
 * runtime, and NOT required for any feature. Swapping the adapter must not
 * require changes in the marketplace or order modules.
 *
 * Adapter calls are made OUTSIDE database transactions (they model calls to an
 * external system), and their results are then recorded transactionally.
 */
export interface VirtualServiceSpec {
  serviceId: string;
  bandwidthMbps: number;
  primarySegmentIds: string[];
  protectionSegmentIds: string[] | null;
  providerIds: string[];
}

export interface ValidationResult {
  testName: string;
  status: 'PASS' | 'FAIL' | 'NOT_RUN';
  simulated: true;
  input: Record<string, unknown>;
  threshold: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  reason: string;
}

export interface FaultSpec {
  type: FaultType;
  targetType: 'SEGMENT' | 'NODE' | 'PORT' | 'PROVIDER' | 'SERVICE' | 'GLOBAL';
  targetId: string | null;
  params?: Record<string, unknown>;
  groupId?: string;
}

export const FAULT_TYPES = [
  'FIBER_CUT', 'NODE_DOWN', 'PORT_DOWN', 'CAPACITY_EXHAUSTION', 'HIGH_LATENCY', 'PACKET_LOSS',
  'PROVIDER_API_TIMEOUT', 'PROVISIONING_FAILURE', 'SCHEDULED_MAINTENANCE', 'CUSTOMER_SIDE_OUTAGE',
] as const;
export type FaultType = (typeof FAULT_TYPES)[number];

export const FAULT_TARGET: Record<FaultType, FaultSpec['targetType'][]> = {
  FIBER_CUT: ['SEGMENT'],
  NODE_DOWN: ['NODE'],
  PORT_DOWN: ['PORT'],
  CAPACITY_EXHAUSTION: ['SEGMENT'],
  HIGH_LATENCY: ['SEGMENT'],
  PACKET_LOSS: ['SEGMENT'],
  PROVIDER_API_TIMEOUT: ['PROVIDER'],
  PROVISIONING_FAILURE: ['PROVIDER', 'GLOBAL'],
  SCHEDULED_MAINTENANCE: ['SEGMENT'],
  CUSTOMER_SIDE_OUTAGE: ['SERVICE'],
};

export class SimulationError extends Error {
  constructor(public code: string, message: string, public retryable = false) {
    super(message);
  }
}

export interface AdapterStatus {
  name: string;
  mode: 'DETERMINISTIC' | 'CONTAINERLAB' | 'MININET_OPTICAL';
  available: boolean;
  label: 'SIMULATED' | 'NOT AVAILABLE' | 'NOT CONNECTED';
  detail: string;
}

export interface NetworkSimulationAdapter {
  status(): Promise<AdapterStatus>;
  createVirtualService(spec: VirtualServiceSpec): Promise<{ handle: string; readyAt: Date }>;
  activateService(handle: string): Promise<void>;
  deactivateService(handle: string): Promise<void>;
  getServiceStatus(handle: string): Promise<{ handle: string; state: string; activePath: string | null; operStatus: string }>;
  runConnectivityTest(handle: string): Promise<ValidationResult[]>;
  readMetrics(handle: string, fromTick: number, toTick: number): Promise<unknown[]>;
  injectFault(spec: FaultSpec, actorId: string | null): Promise<{ faultIds: string[]; incidentId: string | null }>;
  restoreFault(faultId: string, actorId: string | null): Promise<void>;
  resetScenario(actorId: string | null): Promise<void>;
}
