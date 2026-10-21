/**
 * MEF/Mplify LSO Sonata integration boundary — MOCK ONLY.
 *
 * Provenance and honesty notes:
 *  - The Sonata SDK spec files are NOT in this repository. What is used here
 *    comes from the user's REA notes (LSO-SDK-analisis.md, 2026-10-21):
 *      * base path /mefApi/sonata/productOrderingManagement/v11/ (v11.0.1)
 *      * POST /productOrder -> 201, state 'acknowledged'
 *      * states acknowledged -> inProgress -> completed (verified enum values)
 *      * order item quoteItem ref requires [id, quoteId]; quote may be optional per Seller policy
 *      * OAuth2 clientCredentials, scope 'default'; the spec tokenUrl is a placeholder
 *  - Every other field name below is ILLUSTRATIVE. This module makes NO
 *    conformance claim. Audit against productOrderManagement.api.yaml before
 *    building a real adapter.
 *  - Sonata is a business (product order) API. It does NOT configure optical or
 *    packet equipment; device configuration is the Seller's internal concern.
 */
import { Type, type Static } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import type { Queryable } from '../../db/db.js';
import { newId } from '../../lib/util.js';
import { SONATA_STATE, type OrderState } from '../../domain/state-machines.js';
import { providerFaultActive } from '../simulation/engine.js';

export const SONATA_BASE_PATH = '/mefApi/sonata/productOrderingManagement/v11';

// -------- internal canonical model (platform-owned, adapter-independent) --------
export interface CanonicalOrderItem {
  itemId: string;
  action: 'add';
  productCode: string;
  bandwidthMbps: number;
  segmentIds: string[];
  aEnd: { locationId: string; nodeId: string };
  bEnd: { locationId: string; nodeId: string };
  termMonths: number;
  quote: { quoteId: string; quoteItemId: string };
}
export interface CanonicalProviderOrder {
  platformOrderId: string;
  subOrderId: string;
  providerId: string;
  buyerId: string;
  items: CanonicalOrderItem[];
}

// -------- illustrative contract (subset; NOT the official schema) --------
export const SonataProductOrderCreate = Type.Object(
  {
    externalId: Type.String({ minLength: 1 }),
    productOrderItem: Type.Array(
      Type.Object({
        id: Type.String({ minLength: 1 }),
        action: Type.Literal('add'),
        quoteItem: Type.Optional(Type.Object({ id: Type.String({ minLength: 1 }), quoteId: Type.String({ minLength: 1 }) })),
        product: Type.Object({
          productOffering: Type.Object({ id: Type.String() }),
          productConfiguration: Type.Object({ '@type': Type.String() }, { additionalProperties: true }),
          place: Type.Array(Type.Object({ '@type': Type.String(), id: Type.String(), role: Type.String() }), { minItems: 2 }),
        }),
        requestedItemTerm: Type.Object({ duration: Type.Object({ amount: Type.Integer({ minimum: 1 }), units: Type.Literal('calendarMonths') }) }),
      }),
      { minItems: 1 },
    ),
  },
  { $id: 'IllustrativeSonataProductOrderCreate', additionalProperties: true },
);
export type SonataProductOrderCreateT = Static<typeof SonataProductOrderCreate>;

export const SonataProductOrderResponse = Type.Object({
  id: Type.String(),
  externalId: Type.String(),
  state: Type.Union([Type.Literal('acknowledged'), Type.Literal('inProgress'), Type.Literal('completed'), Type.Literal('cancelled'), Type.Literal('rejected'), Type.Literal('failed')]),
  productOrderItem: Type.Array(Type.Object({ id: Type.String(), state: Type.String() })),
});

export function toSonataCreate(o: CanonicalProviderOrder): SonataProductOrderCreateT {
  return {
    externalId: `${o.platformOrderId}/${o.subOrderId}`,
    productOrderItem: o.items.map((it) => ({
      id: it.itemId,
      action: 'add' as const,
      quoteItem: { id: it.quote.quoteItemId, quoteId: it.quote.quoteId },
      product: {
        productOffering: { id: `cring-sim-${it.productCode.toLowerCase()}` },
        productConfiguration: {
          '@type': 'urn:x-cring-sim:illustrative:access-e-line', // illustrative, not a MEF schema URN
          bandwidthMbps: it.bandwidthMbps,
          segmentIds: it.segmentIds,
        },
        place: [
          { '@type': 'GeographicSiteRef', id: it.aEnd.locationId, role: 'A-END' },
          { '@type': 'GeographicSiteRef', id: it.bEnd.locationId, role: 'B-END' },
        ],
      },
      requestedItemTerm: { duration: { amount: it.termMonths, units: 'calendarMonths' as const } },
    })),
  };
}

export function contractErrors(schema: typeof SonataProductOrderCreate | typeof SonataProductOrderResponse, value: unknown) {
  return [...Value.Errors(schema, value)].map((e) => `${e.path || '/'}: ${e.message}`);
}

export function sonataStateOf(orderState: OrderState) {
  return SONATA_STATE[orderState];
}

export class SonataTimeoutError extends Error {
  code = 'PROVIDER_API_TIMEOUT';
}

/** Seller-side mock. Default-deny: it never performs network I/O. */
export class SonataMockSeller {
  readonly mode = 'MOCK' as const;
  async createProductOrder(q: Queryable, providerId: string, body: SonataProductOrderCreateT, orderId: string, now: Date) {
    const errors = contractErrors(SonataProductOrderCreate, body);
    let response: unknown;
    if (errors.length) response = { status: 422, errors };
    else if (await providerFaultActive(q, 'PROVIDER_API_TIMEOUT', [providerId])) response = { status: 504, error: 'simulated timeout' };
    else
      response = {
        status: 201,
        body: {
          id: newId('mock-po'),
          externalId: body.externalId,
          state: 'acknowledged',
          productOrderItem: body.productOrderItem.map((i) => ({ id: i.id, state: 'acknowledged' })),
        },
      };
    await q.query(
      `INSERT INTO sonata_messages (id, order_id, provider_id, direction, operation, adapter_mode, request, response, created_at)
       VALUES ($1,$2,$3,'OUTBOUND','createProductOrder','MOCK',$4,$5,$6)`,
      [newId('msg'), orderId, providerId, JSON.stringify({ method: 'POST', path: `${SONATA_BASE_PATH}/productOrder`, body }), JSON.stringify(response), now],
    );
    const r = response as any;
    if (r.status === 504) throw new SonataTimeoutError(`Provider ${providerId} order API timed out (simulated)`);
    if (r.status !== 201) throw new Error(`Mock seller rejected request: ${errors.join('; ')}`);
    return r.body as Static<typeof SonataProductOrderResponse>;
  }
}

/** Placeholder for a future real adapter. Constructing it fails on purpose. */
export class SonataRealAdapter {
  constructor() {
    throw new Error('NOT CONNECTED: a real Sonata adapter is out of scope for this phase (see docs/architecture/integration-gates.md).');
  }
}

export const SONATA_INTEGRATION_STATUS = {
  name: 'MEF/Mplify LSO Sonata (Buyer↔Seller product order)',
  mode: 'MOCK',
  connection: 'NOT CONNECTED',
  basePath: SONATA_BASE_PATH,
  conformance: 'NONE CLAIMED — illustrative mapping only',
  tokenUrl: 'not configured (SDK spec value is a placeholder: http://mef.net/example/token)',
  source: 'User REA notes LSO-SDK-analisis.md (2026-10-21); SDK files not present in this repository',
};
