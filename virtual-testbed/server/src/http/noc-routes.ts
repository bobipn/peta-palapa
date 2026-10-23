import { Type } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { guard, guardAudited } from './app.js';
import type { Ctx } from '../modules/context.js';
import { deviceDetail, ipam, listDevices, renderRunningConfig, serviceNetwork, vlanTable } from '../modules/netconfig.js';
import {
  ackAlarms, addAlarmComment, alarmDetail, alarmStats, alarmsCsv, clearAlarm, deviceMap, deviceMetrics, outages, probes, setPortAdmin,
} from '../modules/noc-views.js';

const Id = Type.Object({ id: Type.String({ minLength: 1, maxLength: 80 }) });

/** NOC v2 endpoints: devices, device map, performance, outages, probes, IPAM/VLAN, alarm console actions. */
export async function registerNocRoutes(fastify: FastifyInstance, ctx: Ctx) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();
  const t = { tags: ['noc'] };

  app.get('/api/devices', { schema: t, preHandler: guard('devices:read') }, async () => listDevices(ctx.db));
  app.get('/api/devices/:id', { schema: { ...t, params: Id }, preHandler: guard('devices:read') }, async (req) => deviceDetail(ctx.db, req.params.id));
  app.get('/api/devices/:id/config', { schema: { ...t, params: Id, description: 'SIMULATED running config (pseudo-CLI)' }, preHandler: guard('devices:read') }, async (req, reply) =>
    reply.type('text/plain; charset=utf-8').send(await renderRunningConfig(ctx.db, req.params.id)));
  app.get('/api/devices/:id/metrics', {
    schema: { ...t, params: Id, querystring: Type.Object({ ticks: Type.Optional(Type.Integer({ minimum: 10, maximum: 1440 })), endTick: Type.Optional(Type.Integer({ minimum: 0 })) }) },
    preHandler: guard('devices:read'),
  }, async (req) => deviceMetrics(ctx.db, req.params.id, req.query.ticks ?? 60, req.query.endTick));
  app.post('/api/devices/:id/ports/:portId/admin', {
    schema: { ...t, params: Type.Object({ id: Type.String({ maxLength: 80 }), portId: Type.String({ maxLength: 80 }) }), body: Type.Object({ status: Type.Union([Type.Literal('UP'), Type.Literal('DOWN')]) }),
      description: 'shutdown / no shutdown on a SIMULATED interface (modelled as a PORT_DOWN fault)' },
    preHandler: guardAudited(ctx, 'devices:control'),
  }, async (req) => setPortAdmin(ctx, req.meta, req.params.id, req.params.portId, req.body.status));

  app.get('/api/device-map', { schema: t, preHandler: guard('devices:read') }, async () => deviceMap(ctx.db));
  app.get('/api/outages', { schema: t, preHandler: guard('devices:read') }, async () => outages(ctx.db));
  app.get('/api/probes', { schema: t, preHandler: guard('devices:read') }, async () => probes(ctx.db));
  app.get('/api/ipam', { schema: t, preHandler: guard('devices:read') }, async () => ipam(ctx.db));
  app.get('/api/vlans', { schema: t, preHandler: guard('devices:read') }, async () => vlanTable(ctx.db));
  app.get('/api/services/:id/network', { schema: { ...t, params: Id }, preHandler: guard('services:read') }, async (req) => serviceNetwork(ctx.db, req.principal!, req.params.id));

  // Alarm console
  app.get('/api/alarms/stats', { schema: t, preHandler: guard('assurance:read') }, async (req) => alarmStats(ctx.db, req.principal!));
  app.get('/api/alarms/export.csv', { schema: { ...t, querystring: Type.Object({ state: Type.Optional(Type.Union([Type.Literal('ACTIVE'), Type.Literal('CLEARED')])) }) }, preHandler: guard('assurance:read') }, async (req, reply) =>
    reply.type('text/csv; charset=utf-8').header('Content-Disposition', 'attachment; filename="alarms-simulated.csv"').send(await alarmsCsv(ctx.db, req.principal!, req.query.state)));
  app.get('/api/alarms/:id', { schema: { ...t, params: Id }, preHandler: guard('assurance:read') }, async (req) => alarmDetail(ctx.db, req.principal!, req.params.id));
  app.post('/api/alarms/ack', { schema: { ...t, body: Type.Object({ ids: Type.Array(Type.String({ maxLength: 80 }), { minItems: 1, maxItems: 500 }) }) }, preHandler: guardAudited(ctx, 'alarms:ack') }, async (req) =>
    ackAlarms(ctx, req.meta, req.body.ids));
  app.post('/api/alarms/:id/clear', { schema: { ...t, params: Id }, preHandler: guardAudited(ctx, 'alarms:clear') }, async (req) => clearAlarm(ctx, req.meta, req.params.id));
  app.post('/api/alarms/:id/comments', { schema: { ...t, params: Id, body: Type.Object({ text: Type.String({ minLength: 1, maxLength: 1000 }) }) }, preHandler: guardAudited(ctx, 'alarms:comment') }, async (req) =>
    addAlarmComment(ctx, req.meta, req.params.id, req.body.text));
}
