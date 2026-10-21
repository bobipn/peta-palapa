/**
 * Explicit state machines. The business order and the network service are
 * separate aggregates with separate lifecycles; the orchestrator moves them
 * in lock-step but neither knows about the other's internals.
 */

// ---------------- Business order ----------------
export const ORDER_STATES = [
  'PENDING_PAYMENT', 'CONFIRMED', 'PROVIDER_ACCEPTANCE', 'RESOURCE_RESERVED', 'PROVISIONING', 'TESTING', 'ACTIVE',
  'CANCELLED', 'REJECTED', 'FAILED', 'DISCONNECTED',
] as const;
export type OrderState = (typeof ORDER_STATES)[number];

const ORDER_TRANSITIONS: Record<OrderState, OrderState[]> = {
  PENDING_PAYMENT: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROVIDER_ACCEPTANCE', 'FAILED', 'CANCELLED'],
  PROVIDER_ACCEPTANCE: ['RESOURCE_RESERVED', 'REJECTED', 'FAILED', 'CANCELLED'],
  RESOURCE_RESERVED: ['PROVISIONING', 'FAILED', 'CANCELLED'],
  PROVISIONING: ['TESTING', 'FAILED'],
  TESTING: ['ACTIVE', 'FAILED'],
  ACTIVE: ['DISCONNECTED'],
  CANCELLED: [],
  REJECTED: [],
  FAILED: [],
  DISCONNECTED: [],
};

export const ORDER_TERMINAL: OrderState[] = ['CANCELLED', 'REJECTED', 'FAILED', 'DISCONNECTED'];
/** States from which a customer may still cancel (before anything is built). */
export const ORDER_CANCELLABLE: OrderState[] = ['PENDING_PAYMENT', 'CONFIRMED', 'PROVIDER_ACCEPTANCE', 'RESOURCE_RESERVED'];

export function canTransitionOrder(from: OrderState, to: OrderState) {
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Plain-language status for customers. */
export const ORDER_STATE_LABEL: Record<OrderState, string> = {
  PENDING_PAYMENT: 'Waiting for (simulated) payment',
  CONFIRMED: 'Payment received — capacity on hold',
  PROVIDER_ACCEPTANCE: 'Waiting for cable owners to accept',
  RESOURCE_RESERVED: 'Capacity reserved on all segments',
  PROVISIONING: 'Building the virtual service',
  TESTING: 'Running activation tests',
  ACTIVE: 'Service is active',
  CANCELLED: 'Cancelled',
  REJECTED: 'Rejected by a cable owner',
  FAILED: 'Failed — resources released',
  DISCONNECTED: 'Disconnected',
};

/**
 * Illustrative mapping to MEF/Mplify LSO Sonata ProductOrder states.
 * Only acknowledged / inProgress / completed / cancelled were confirmed by the
 * user's REA of the Sonata SDK (productOrderManagement v11.0.1). 'rejected' and
 * 'failed' are believed to exist in the spec enum but are UNVERIFIED here.
 */
export const SONATA_STATE: Record<OrderState, { state: string; verified: boolean }> = {
  PENDING_PAYMENT: { state: 'acknowledged', verified: true },
  CONFIRMED: { state: 'acknowledged', verified: true },
  PROVIDER_ACCEPTANCE: { state: 'acknowledged', verified: true },
  RESOURCE_RESERVED: { state: 'inProgress', verified: true },
  PROVISIONING: { state: 'inProgress', verified: true },
  TESTING: { state: 'inProgress', verified: true },
  ACTIVE: { state: 'completed', verified: true },
  CANCELLED: { state: 'cancelled', verified: true },
  REJECTED: { state: 'rejected', verified: false },
  FAILED: { state: 'failed', verified: false },
  DISCONNECTED: { state: 'completed', verified: false },
};

// ---------------- Network service ----------------
export const SERVICE_STATES = ['DESIGNED', 'RESERVED', 'PROVISIONING', 'CONFIGURED', 'TESTING', 'ACTIVE', 'FAILED', 'DECOMMISSIONED'] as const;
export type ServiceState = (typeof SERVICE_STATES)[number];

const SERVICE_TRANSITIONS: Record<ServiceState, ServiceState[]> = {
  DESIGNED: ['RESERVED', 'FAILED', 'DECOMMISSIONED'],
  RESERVED: ['PROVISIONING', 'FAILED', 'DECOMMISSIONED'],
  PROVISIONING: ['CONFIGURED', 'FAILED'],
  CONFIGURED: ['TESTING', 'FAILED'],
  TESTING: ['ACTIVE', 'FAILED'],
  ACTIVE: ['DECOMMISSIONED'],
  FAILED: ['DECOMMISSIONED'],
  DECOMMISSIONED: [],
};

export function canTransitionService(from: ServiceState, to: ServiceState) {
  return SERVICE_TRANSITIONS[from]?.includes(to) ?? false;
}
