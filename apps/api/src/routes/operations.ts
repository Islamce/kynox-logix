import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { requireAuth, requirePermission } from '../middleware/auth';
import { asyncHandler, HttpError } from '../middleware/errors';
import { audit } from '../services/audit';
import {
  OPERATIONAL_EVENT_TYPES, SHIPMENT_STATUSES, asUtcIso, canTransition, eventForTransition,
  isShipmentStatus, operationId, payloadDigest, type ShipmentStatus,
} from '../services/logisticsOperations';
import { analyzeTransportSpend, evaluateCarrierPerformance } from '@kynox/logistics-engine';

export const operationsRouter = Router();
operationsRouter.use(requireAuth);

const idSchema = z.string().min(1).max(64);
const timestampSchema = z.string().min(1).max(64).refine((value) => Number.isFinite(Date.parse(value)), 'Must be a valid timestamp');
const providerTypeSchema = z.enum(['carrier', '3pl', 'forwarder']);
const providerStatusSchema = z.enum(['active', 'inactive', 'suspended']);
const exceptionStatusSchema = z.enum(['open', 'acknowledged', 'in_progress', 'resolved', 'dismissed']);
const exceptionSeveritySchema = z.enum(['critical', 'high', 'medium', 'low', 'info']);
const safeReferenceSchema = z.string().min(1).max(255);

function requestId(req: { correlationId?: string }): string {
  return req.correlationId ?? operationId('corr');
}

function isUniqueViolation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /unique|duplicate/i.test(message);
}

async function getShipment(id: string, tenantId: string) {
  const shipment = await db('shipments').where({ id, tenant_id: tenantId }).first();
  if (!shipment) throw new HttpError(404, 'Shipment not found');
  return shipment;
}

async function getProvider(id: string, tenantId: string) {
  const provider = await db('logistics_providers').where({ id, tenant_id: tenantId }).first();
  if (!provider) throw new HttpError(404, 'Provider not found');
  return provider;
}

async function claimIdempotency(
  trx: typeof db,
  tenantId: string,
  scope: string,
  key: string,
  digest: string,
  entityId?: string,
): Promise<{ replay: boolean; entityId: string | null }> {
  const existing = await trx('logistics_idempotency').where({ tenant_id: tenantId, scope, idempotency_key: key }).first();
  if (existing) {
    if (existing.request_digest !== digest) throw new HttpError(409, 'Idempotency key was already used with a different payload');
    return { replay: true, entityId: existing.entity_id ?? null };
  }
  try {
    await trx('logistics_idempotency').insert({
      tenant_id: tenantId, scope, idempotency_key: key, request_digest: digest, entity_id: entityId ?? null,
    });
    return { replay: false, entityId: entityId ?? null };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const raced = await trx('logistics_idempotency').where({ tenant_id: tenantId, scope, idempotency_key: key }).first();
    if (!raced || raced.request_digest !== digest) throw new HttpError(409, 'Idempotency key was already used with a different payload');
    return { replay: true, entityId: raced.entity_id ?? null };
  }
}

function safePayload(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const serialised = JSON.stringify(value);
  if (serialised.length > 16_000) throw new HttpError(413, 'Event payload exceeds the 16KB operations evidence limit');
  return serialised;
}

async function assertEventChronology(
  trx: typeof db, tenantId: string, shipmentId: string, occurredAt: string,
): Promise<void> {
  const latest = await trx('logistics_events')
    .where({ tenant_id: tenantId, shipment_id: shipmentId })
    .orderBy('occurred_at', 'desc').first('occurred_at');
  if (latest?.occurred_at && Date.parse(occurredAt) < Date.parse(latest.occurred_at)) {
    throw new HttpError(422, 'Operational event chronology cannot precede the latest accepted shipment event');
  }
}

const providerSchema = z.object({
  code: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(180),
  providerType: providerTypeSchema,
  status: providerStatusSchema.default('active'),
  serviceTypes: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  externalSystem: z.string().trim().min(1).max(80).optional(),
  externalId: z.string().trim().min(1).max(160).optional(),
  contractReference: z.string().trim().min(1).max(160).optional(),
});

operationsRouter.get('/providers', requirePermission('view_operations'), asyncHandler(async (req, res) => {
  const providers = await db('logistics_providers').where({ tenant_id: req.user!.tenantId }).orderBy('name');
  res.json({ providers: providers.map(serializeProvider) });
}));

operationsRouter.post('/providers', requirePermission('manage_providers'), asyncHandler(async (req, res) => {
  const body = providerSchema.parse(req.body);
  const provider = {
    id: operationId('provider'), tenant_id: req.user!.tenantId, code: body.code, name: body.name,
    provider_type: body.providerType, status: body.status, service_types: JSON.stringify(body.serviceTypes),
    external_system: body.externalSystem ?? null, external_id: body.externalId ?? null,
    contract_reference: body.contractReference ?? null,
  };
  try {
    await db('logistics_providers').insert(provider);
  } catch (error) {
    if (isUniqueViolation(error)) throw new HttpError(409, 'Provider code already exists in this tenant');
    throw error;
  }
  await audit({
    action: 'logistics_provider_created', userId: req.user!.id, tenantId: req.user!.tenantId,
    entityType: 'logistics_provider', entityId: provider.id, newValue: { code: body.code, providerType: body.providerType },
    sourceIp: req.ip, correlationId: requestId(req),
  });
  res.status(201).json({ provider: serializeProvider(provider) });
}));

const requirementSchema = z.object({
  requirementNumber: z.string().trim().min(1).max(100),
  originLocationId: z.string().trim().min(1).max(120).optional(),
  destinationLocationId: z.string().trim().min(1).max(120).optional(),
  requiredDeliveryAt: timestampSchema.optional(),
  orderReference: z.string().trim().min(1).max(160).optional(),
  projectReference: z.string().trim().min(1).max(160).optional(),
  wbsReference: z.string().trim().min(1).max(160).optional(),
  sourceSystem: z.string().trim().min(1).max(80).optional(),
  sourceRecordId: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().min(1).max(2000).optional(),
});

operationsRouter.get('/transport-requirements', requirePermission('view_operations'), asyncHandler(async (req, res) => {
  const requirements = await db('transport_requirements').where({ tenant_id: req.user!.tenantId }).orderBy('created_at', 'desc');
  res.json({ transportRequirements: requirements.map(serializeRequirement) });
}));

operationsRouter.post('/transport-requirements', requirePermission('manage_operations'), asyncHandler(async (req, res) => {
  const body = requirementSchema.parse(req.body);
  const requirement = {
    id: operationId('tr'), tenant_id: req.user!.tenantId, requirement_number: body.requirementNumber,
    status: 'requested', origin_location_id: body.originLocationId ?? null, destination_location_id: body.destinationLocationId ?? null,
    required_delivery_at: body.requiredDeliveryAt ? asUtcIso(body.requiredDeliveryAt, 'requiredDeliveryAt') : null,
    order_reference: body.orderReference ?? null, project_reference: body.projectReference ?? null, wbs_reference: body.wbsReference ?? null,
    source_system: body.sourceSystem ?? null, source_record_id: body.sourceRecordId ?? null, description: body.description ?? null,
    created_by: req.user!.id,
  };
  try {
    await db('transport_requirements').insert(requirement);
  } catch (error) {
    if (isUniqueViolation(error)) throw new HttpError(409, 'Transport requirement number already exists in this tenant');
    throw error;
  }
  await audit({
    action: 'transport_requirement_created', userId: req.user!.id, tenantId: req.user!.tenantId,
    entityType: 'transport_requirement', entityId: requirement.id,
    newValue: { requirementNumber: body.requirementNumber, sourceSystem: body.sourceSystem ?? null },
    sourceIp: req.ip, correlationId: requestId(req),
  });
  res.status(201).json({ transportRequirement: serializeRequirement(requirement) });
}));

const referenceSchema = z.object({
  type: z.enum(['order', 'purchase_order', 'sales_order', 'project', 'wbs', 'material', 'customer', 'external_tracking']),
  value: safeReferenceSchema,
  sourceSystem: z.string().trim().min(1).max(80).optional(),
  sourceRecordId: z.string().trim().min(1).max(160).optional(),
});

const legSchema = z.object({
  sequence: z.number().int().positive(),
  mode: z.enum(['road', 'air', 'sea', 'rail', 'courier', 'multimodal']).optional(),
  providerId: idSchema.optional(),
  originLocationId: z.string().trim().min(1).max(120),
  destinationLocationId: z.string().trim().min(1).max(120),
  plannedDepartureAt: timestampSchema.optional(),
  plannedArrivalAt: timestampSchema.optional(),
});

const shipmentSchema = z.object({
  shipmentNumber: z.string().trim().min(1).max(100),
  transportRequirementId: idSchema.optional(),
  providerId: idSchema.optional(),
  mode: z.enum(['road', 'air', 'sea', 'rail', 'courier', 'multimodal']).optional(),
  originLocationId: z.string().trim().min(1).max(120),
  destinationLocationId: z.string().trim().min(1).max(120),
  plannedPickupAt: timestampSchema.optional(),
  plannedDeliveryAt: timestampSchema.optional(),
  requiredDeliveryAt: timestampSchema.optional(),
  trackingNumber: z.string().trim().min(1).max(160).optional(),
  weight: z.number().finite().positive().optional(),
  weightUom: z.string().trim().min(1).max(16).optional(),
  customerReference: z.string().trim().min(1).max(160).optional(),
  projectReference: z.string().trim().min(1).max(160).optional(),
  references: z.array(referenceSchema).max(30).default([]),
  legs: z.array(legSchema).max(12).default([]),
});

operationsRouter.get('/shipments', requirePermission('view_operations'), asyncHandler(async (req, res) => {
  const status = typeof req.query.status === 'string' && isShipmentStatus(req.query.status) ? req.query.status : undefined;
  let query = db('shipments as s')
    .leftJoin('logistics_providers as p', function joinProvider() {
      this.on('s.provider_id', '=', 'p.id').andOn('p.tenant_id', '=', 's.tenant_id');
    })
    .where('s.tenant_id', req.user!.tenantId)
    .select('s.*', 'p.code as provider_code', 'p.name as provider_name', 'p.provider_type as provider_type')
    .orderBy('s.created_at', 'desc');
  if (status) query = query.andWhere('s.status', status);
  const shipments = await query;
  const ids = shipments.map((shipment) => shipment.id);
  const counts = ids.length
    ? await db('logistics_exceptions').where({ tenant_id: req.user!.tenantId }).whereIn('shipment_id', ids)
      .whereNotIn('status', ['resolved', 'dismissed']).groupBy('shipment_id').select('shipment_id').count({ count: '*' })
    : [];
  const openExceptionCount = new Map((counts as Array<{ shipment_id: string; count: string | number }>).map((row) => [row.shipment_id, Number(row.count)]));
  res.json({ shipments: shipments.map((shipment) => ({ ...serializeShipment(shipment), openExceptionCount: openExceptionCount.get(shipment.id) ?? 0 })) });
}));

operationsRouter.post('/shipments', requirePermission('manage_operations'), asyncHandler(async (req, res) => {
  const body = shipmentSchema.parse(req.body);
  if (body.weight && !body.weightUom) throw new HttpError(422, 'weightUom is required when weight is supplied');
  if (body.transportRequirementId) {
    const requirement = await db('transport_requirements').where({ id: body.transportRequirementId, tenant_id: req.user!.tenantId }).first();
    if (!requirement) throw new HttpError(404, 'Transport requirement not found');
  }
  if (body.providerId) await getProvider(body.providerId, req.user!.tenantId);
  for (const leg of body.legs) if (leg.providerId) await getProvider(leg.providerId, req.user!.tenantId);

  const shipmentId = operationId('shipment');
  const occurredAt = new Date().toISOString();
  try {
    await db.transaction(async (trx) => {
      await trx('shipments').insert({
        id: shipmentId, tenant_id: req.user!.tenantId, shipment_number: body.shipmentNumber,
        transport_requirement_id: body.transportRequirementId ?? null, provider_id: body.providerId ?? null,
        status: 'planned', mode: body.mode ?? null, origin_location_id: body.originLocationId,
        destination_location_id: body.destinationLocationId,
        planned_pickup_at: body.plannedPickupAt ? asUtcIso(body.plannedPickupAt, 'plannedPickupAt') : null,
        planned_delivery_at: body.plannedDeliveryAt ? asUtcIso(body.plannedDeliveryAt, 'plannedDeliveryAt') : null,
        required_delivery_at: body.requiredDeliveryAt ? asUtcIso(body.requiredDeliveryAt, 'requiredDeliveryAt') : null,
        tracking_number: body.trackingNumber ?? null, weight: body.weight ?? null, weight_uom: body.weightUom ?? null,
        customer_reference: body.customerReference ?? null, project_reference: body.projectReference ?? null,
        created_by: req.user!.id, updated_by: req.user!.id,
      });
      if (body.references.length) await trx('shipment_references').insert(body.references.map((reference) => ({
        tenant_id: req.user!.tenantId, shipment_id: shipmentId, reference_type: reference.type, reference_value: reference.value,
        source_system: reference.sourceSystem ?? null, source_record_id: reference.sourceRecordId ?? null,
      })));
      if (body.legs.length) await trx('shipment_legs').insert(body.legs.map((leg) => ({
        id: operationId('leg'), tenant_id: req.user!.tenantId, shipment_id: shipmentId, sequence: leg.sequence,
        mode: leg.mode ?? null, provider_id: leg.providerId ?? null, origin_location_id: leg.originLocationId,
        destination_location_id: leg.destinationLocationId,
        planned_departure_at: leg.plannedDepartureAt ? asUtcIso(leg.plannedDepartureAt, 'plannedDepartureAt') : null,
        planned_arrival_at: leg.plannedArrivalAt ? asUtcIso(leg.plannedArrivalAt, 'plannedArrivalAt') : null,
      })));
      const creationEvidence = { shipmentNumber: body.shipmentNumber, providerId: body.providerId ?? null };
      await trx('logistics_events').insert({
        id: operationId('event'), tenant_id: req.user!.tenantId, shipment_id: shipmentId, event_type: 'shipment.created',
        occurred_at: occurredAt, source_system: 'logix.operator', source_record_id: shipmentId,
        correlation_id: requestId(req), idempotency_key: `create:${shipmentId}`,
        payload_digest: payloadDigest(creationEvidence), payload: JSON.stringify(creationEvidence), actor_user_id: req.user!.id,
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new HttpError(409, 'Shipment number already exists in this tenant');
    throw error;
  }
  const shipment = await getShipment(shipmentId, req.user!.tenantId);
  await audit({
    action: 'shipment_created', userId: req.user!.id, tenantId: req.user!.tenantId, entityType: 'shipment', entityId: shipmentId,
    newValue: { shipmentNumber: body.shipmentNumber, transportRequirementId: body.transportRequirementId ?? null },
    sourceIp: req.ip, correlationId: requestId(req),
  });
  res.status(201).json({ shipment: serializeShipment(shipment) });
}));

operationsRouter.get('/shipments/:id', requirePermission('view_operations'), asyncHandler(async (req, res) => {
  const shipment = await getShipment(req.params.id, req.user!.tenantId);
  const [provider, legs, references, events, exceptions, pods, charges] = await Promise.all([
    shipment.provider_id ? db('logistics_providers').where({ id: shipment.provider_id, tenant_id: req.user!.tenantId }).first() : null,
    db('shipment_legs').where({ shipment_id: shipment.id, tenant_id: req.user!.tenantId }).orderBy('sequence'),
    db('shipment_references').where({ shipment_id: shipment.id, tenant_id: req.user!.tenantId }).orderBy('id'),
    db('logistics_events').where({ shipment_id: shipment.id, tenant_id: req.user!.tenantId }).orderBy('occurred_at'),
    db('logistics_exceptions').where({ shipment_id: shipment.id, tenant_id: req.user!.tenantId }).orderBy('created_at', 'desc'),
    db('shipment_pods').where({ shipment_id: shipment.id, tenant_id: req.user!.tenantId }).orderBy('created_at', 'desc'),
    db('freight_charges').where({ shipment_id: shipment.id, tenant_id: req.user!.tenantId }).orderBy('created_at', 'desc'),
  ]);
  res.json({
    shipment: serializeShipment(shipment), provider: provider ? serializeProvider(provider) : null,
    legs: legs.map(serializeLeg), references: references.map(serializeReference), events: events.map(serializeEvent),
    exceptions: exceptions.map(serializeException), pods: pods.map(serializePod), charges: charges.map(serializeCharge),
  });
}));

const assignProviderSchema = z.object({ providerId: idSchema, idempotencyKey: z.string().trim().min(8).max(160) });
operationsRouter.post('/shipments/:id/assign-provider', requirePermission('manage_operations'), asyncHandler(async (req, res) => {
  const body = assignProviderSchema.parse(req.body);
  const shipment = await getShipment(req.params.id, req.user!.tenantId);
  await getProvider(body.providerId, req.user!.tenantId);
  const digest = payloadDigest(body);
  const result = await db.transaction(async (trx) => {
    const claim = await claimIdempotency(trx, req.user!.tenantId, `shipment_provider:${shipment.id}`, body.idempotencyKey, digest, shipment.id);
    if (claim.replay) return { replay: true };
    await trx('shipments').where({ id: shipment.id, tenant_id: req.user!.tenantId }).update({ provider_id: body.providerId, updated_by: req.user!.id, updated_at: trx.fn.now() });
    await trx('logistics_events').insert({
      id: operationId('event'), tenant_id: req.user!.tenantId, shipment_id: shipment.id, event_type: 'shipment.provider_assigned',
      occurred_at: new Date().toISOString(), source_system: 'logix.operator', source_record_id: `assignment:${body.idempotencyKey}`,
      correlation_id: requestId(req), idempotency_key: `event:${body.idempotencyKey}`, payload_digest: digest,
      payload: JSON.stringify({ providerId: body.providerId }), actor_user_id: req.user!.id,
    });
    return { replay: false };
  });
  const updated = await getShipment(shipment.id, req.user!.tenantId);
  if (!result.replay) await audit({
    action: 'shipment_provider_assigned', userId: req.user!.id, tenantId: req.user!.tenantId, entityType: 'shipment', entityId: shipment.id,
    prevValue: { providerId: shipment.provider_id ?? null }, newValue: { providerId: body.providerId }, sourceIp: req.ip, correlationId: requestId(req),
  });
  res.status(result.replay ? 200 : 201).json({ idempotent: result.replay, shipment: serializeShipment(updated) });
}));

const transitionSchema = z.object({
  status: z.enum(SHIPMENT_STATUSES),
  occurredAt: timestampSchema.optional(),
  idempotencyKey: z.string().trim().min(8).max(160),
  reason: z.string().trim().min(1).max(1000).optional(),
});
operationsRouter.post('/shipments/:id/transitions', requirePermission('manage_operations'), asyncHandler(async (req, res) => {
  const body = transitionSchema.parse(req.body);
  const shipment = await getShipment(req.params.id, req.user!.tenantId);
  const from = shipment.status as ShipmentStatus;
  const to = body.status;
  if (!canTransition(from, to)) throw new HttpError(409, `Invalid shipment transition: ${from} -> ${to}`);
  if (to === 'pod_confirmed') throw new HttpError(422, 'POD-confirmed status is set only by recording validated POD evidence');
  if (to === 'booked' && !shipment.provider_id) throw new HttpError(422, 'A provider assignment is required before booking a shipment');
  const occurredAt = body.occurredAt ? asUtcIso(body.occurredAt, 'occurredAt') : new Date().toISOString();
  if (to === 'delivered' && shipment.actual_pickup_at && Date.parse(occurredAt) < Date.parse(shipment.actual_pickup_at)) {
    throw new HttpError(422, 'Delivery cannot precede the recorded pickup time');
  }
  const requestDigest = payloadDigest({ shipmentId: shipment.id, ...body, occurredAt });
  const result = await db.transaction(async (trx) => {
    const claim = await claimIdempotency(trx, req.user!.tenantId, `shipment_transition:${shipment.id}`, body.idempotencyKey, requestDigest, shipment.id);
    if (claim.replay) return { replay: true };
    await assertEventChronology(trx, req.user!.tenantId, shipment.id, occurredAt);
    const patch: Record<string, unknown> = { status: to, updated_by: req.user!.id, updated_at: trx.fn.now() };
    if (to === 'picked_up') patch.actual_pickup_at = occurredAt;
    if (to === 'delivered') patch.actual_delivery_at = occurredAt;
    await trx('shipments').where({ id: shipment.id, tenant_id: req.user!.tenantId }).update(patch);
    await trx('logistics_events').insert({
      id: operationId('event'), tenant_id: req.user!.tenantId, shipment_id: shipment.id, event_type: eventForTransition(to),
      occurred_at: occurredAt, source_system: 'logix.operator', source_record_id: `transition:${body.idempotencyKey}`,
      correlation_id: requestId(req), idempotency_key: `event:${body.idempotencyKey}`, payload_digest: requestDigest,
      payload: JSON.stringify({ from, to, reason: body.reason ?? null }), actor_user_id: req.user!.id,
    });
    return { replay: false };
  });
  const updated = await getShipment(shipment.id, req.user!.tenantId);
  if (!result.replay) await audit({
    action: 'shipment_status_changed', userId: req.user!.id, tenantId: req.user!.tenantId, entityType: 'shipment', entityId: shipment.id,
    prevValue: { status: from }, newValue: { status: to, occurredAt }, sourceIp: req.ip, correlationId: requestId(req),
  });
  res.status(result.replay ? 200 : 201).json({ idempotent: result.replay, shipment: serializeShipment(updated) });
}));

const eventSchema = z.object({
  eventType: z.string().trim().min(1).max(80).refine((value) => OPERATIONAL_EVENT_TYPES.has(value), 'Unsupported operational event type'),
  occurredAt: timestampSchema,
  sourceSystem: z.string().trim().min(1).max(80),
  sourceRecordId: z.string().trim().min(1).max(160),
  idempotencyKey: z.string().trim().min(8).max(160),
  shipmentLegId: idSchema.optional(),
  causationId: z.string().trim().min(1).max(80).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});
operationsRouter.post('/shipments/:id/events', requirePermission('manage_operations'), asyncHandler(async (req, res) => {
  const body = eventSchema.parse(req.body);
  const shipment = await getShipment(req.params.id, req.user!.tenantId);
  if (body.shipmentLegId) {
    const leg = await db('shipment_legs').where({ id: body.shipmentLegId, shipment_id: shipment.id, tenant_id: req.user!.tenantId }).first();
    if (!leg) throw new HttpError(404, 'Shipment leg not found');
  }
  const occurredAt = asUtcIso(body.occurredAt, 'occurredAt');
  const evidence = { ...body, occurredAt, shipmentId: shipment.id };
  const digest = payloadDigest(evidence);
  const outcome = await db.transaction(async (trx) => {
    const existing = await trx('logistics_events').where({ tenant_id: req.user!.tenantId, idempotency_key: body.idempotencyKey }).first();
    if (existing) {
      if (existing.payload_digest !== digest) throw new HttpError(409, 'Idempotency key was already used with a different payload');
      return { replay: true, event: existing };
    }
    const claim = await claimIdempotency(trx, req.user!.tenantId, `shipment_event:${shipment.id}`, body.idempotencyKey, digest);
    if (claim.replay) {
      const replayed = await trx('logistics_events').where({ tenant_id: req.user!.tenantId, idempotency_key: body.idempotencyKey }).first();
      if (!replayed) throw new HttpError(409, 'Idempotency state is incomplete; event was not applied');
      return { replay: true, event: replayed };
    }
    const sourceExisting = await trx('logistics_events').where({ tenant_id: req.user!.tenantId, source_system: body.sourceSystem, source_record_id: body.sourceRecordId }).first();
    if (sourceExisting) {
      if (sourceExisting.payload_digest !== digest) throw new HttpError(409, 'Source record already exists with different evidence');
      return { replay: true, event: sourceExisting };
    }
    await assertEventChronology(trx, req.user!.tenantId, shipment.id, occurredAt);
    const event = {
      id: operationId('event'), tenant_id: req.user!.tenantId, shipment_id: shipment.id, shipment_leg_id: body.shipmentLegId ?? null,
      event_type: body.eventType, occurred_at: occurredAt, source_system: body.sourceSystem, source_record_id: body.sourceRecordId,
      correlation_id: requestId(req), causation_id: body.causationId ?? null, idempotency_key: body.idempotencyKey,
      payload_digest: digest, payload: safePayload(body.payload), actor_user_id: req.user!.id,
    };
    await trx('logistics_events').insert(event);
    return { replay: false, event };
  });
  if (!outcome.replay) await audit({
    action: 'logistics_event_recorded', userId: req.user!.id, tenantId: req.user!.tenantId, entityType: 'shipment', entityId: shipment.id,
    newValue: { eventType: body.eventType, sourceSystem: body.sourceSystem, sourceRecordId: body.sourceRecordId },
    sourceIp: req.ip, correlationId: requestId(req),
  });
  res.status(outcome.replay ? 200 : 201).json({ idempotent: outcome.replay, event: serializeEvent(outcome.event) });
}));

const exceptionSchema = z.object({
  eventId: idSchema.optional(),
  exceptionType: z.enum(['pickup_delay', 'carrier_rejection', 'missed_milestone', 'eta_slippage', 'damaged_cargo', 'missing_pod', 'rate_discrepancy', 'invoice_discrepancy', 'other']),
  severity: exceptionSeveritySchema,
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(4000).optional(),
  ownerUserId: z.number().int().positive().optional(),
  slaDueAt: timestampSchema.optional(),
  impactReferences: z.array(z.object({ type: z.enum(['material', 'order', 'inventory', 'customer', 'project', 'wbs']), value: safeReferenceSchema })).max(20).default([]),
  recommendedAction: z.string().trim().min(1).max(2000).optional(),
});
operationsRouter.post('/shipments/:id/exceptions', requirePermission('manage_operations'), asyncHandler(async (req, res) => {
  const body = exceptionSchema.parse(req.body);
  const shipment = await getShipment(req.params.id, req.user!.tenantId);
  if (body.eventId) {
    const event = await db('logistics_events').where({ id: body.eventId, shipment_id: shipment.id, tenant_id: req.user!.tenantId }).first();
    if (!event) throw new HttpError(404, 'Operational event not found');
  }
  if (body.ownerUserId) {
    const membership = await db('tenant_memberships').where({ tenant_id: req.user!.tenantId, user_id: body.ownerUserId, active: true }).first();
    if (!membership) throw new HttpError(422, 'Exception owner must be an active member of this tenant');
  }
  const exception = {
    id: operationId('exception'), tenant_id: req.user!.tenantId, shipment_id: shipment.id, event_id: body.eventId ?? null,
    exception_type: body.exceptionType, severity: body.severity, status: 'open', title: body.title,
    description: body.description ?? null, owner_user_id: body.ownerUserId ?? null,
    sla_due_at: body.slaDueAt ? asUtcIso(body.slaDueAt, 'slaDueAt') : null,
    impact_references: JSON.stringify(body.impactReferences), recommended_action: body.recommendedAction ?? null, created_by: req.user!.id,
  };
  await db.transaction(async (trx) => {
    await trx('logistics_exceptions').insert(exception);
    const evidence = { exceptionId: exception.id, type: body.exceptionType, severity: body.severity };
    await trx('logistics_events').insert({
      id: operationId('event'), tenant_id: req.user!.tenantId, shipment_id: shipment.id, event_type: 'exception.created',
      occurred_at: new Date().toISOString(), source_system: 'logix.operator', source_record_id: exception.id,
      correlation_id: requestId(req), idempotency_key: `exception:${exception.id}`, payload_digest: payloadDigest(evidence),
      payload: JSON.stringify(evidence), actor_user_id: req.user!.id,
    });
  });
  await audit({
    action: 'logistics_exception_created', userId: req.user!.id, tenantId: req.user!.tenantId, entityType: 'logistics_exception', entityId: exception.id,
    newValue: { shipmentId: shipment.id, exceptionType: body.exceptionType, severity: body.severity }, sourceIp: req.ip, correlationId: requestId(req),
  });
  res.status(201).json({ exception: serializeException(exception) });
}));

const exceptionPatchSchema = z.object({
  status: exceptionStatusSchema.optional(),
  ownerUserId: z.number().int().positive().nullable().optional(),
  resolutionNote: z.string().trim().min(1).max(4000).optional(),
});
operationsRouter.patch('/exceptions/:id', requirePermission('manage_operations'), asyncHandler(async (req, res) => {
  const body = exceptionPatchSchema.parse(req.body);
  const exception = await db('logistics_exceptions').where({ id: req.params.id, tenant_id: req.user!.tenantId }).first();
  if (!exception) throw new HttpError(404, 'Logistics exception not found');
  if (body.ownerUserId) {
    const membership = await db('tenant_memberships').where({ tenant_id: req.user!.tenantId, user_id: body.ownerUserId, active: true }).first();
    if (!membership) throw new HttpError(422, 'Exception owner must be an active member of this tenant');
  }
  const nextStatus = body.status ?? exception.status;
  if ((nextStatus === 'resolved' || nextStatus === 'dismissed') && !body.resolutionNote && !exception.resolution_note) {
    throw new HttpError(422, 'A resolution note is required when resolving or dismissing an exception');
  }
  const patch: Record<string, unknown> = { updated_at: db.fn.now() };
  if (body.status) patch.status = body.status;
  if (body.ownerUserId !== undefined) patch.owner_user_id = body.ownerUserId;
  if (body.resolutionNote) patch.resolution_note = body.resolutionNote;
  if (nextStatus === 'resolved' || nextStatus === 'dismissed') { patch.resolved_by = req.user!.id; patch.resolved_at = new Date().toISOString(); }
  await db.transaction(async (trx) => {
    await trx('logistics_exceptions').where({ id: exception.id, tenant_id: req.user!.tenantId }).update(patch);
    if ((nextStatus === 'resolved' || nextStatus === 'dismissed') && exception.status !== nextStatus) {
      const evidence = { exceptionId: exception.id, status: nextStatus };
      await trx('logistics_events').insert({
        id: operationId('event'), tenant_id: req.user!.tenantId, shipment_id: exception.shipment_id, event_type: 'exception.resolved',
        occurred_at: new Date().toISOString(), source_system: 'logix.operator', source_record_id: `resolution:${exception.id}:${nextStatus}`,
        correlation_id: requestId(req), idempotency_key: `exception-resolution:${exception.id}:${nextStatus}`,
        payload_digest: payloadDigest(evidence), payload: JSON.stringify(evidence), actor_user_id: req.user!.id,
      });
    }
  });
  const updated = await db('logistics_exceptions').where({ id: exception.id, tenant_id: req.user!.tenantId }).first();
  await audit({
    action: 'logistics_exception_updated', userId: req.user!.id, tenantId: req.user!.tenantId, entityType: 'logistics_exception', entityId: exception.id,
    prevValue: { status: exception.status, ownerUserId: exception.owner_user_id },
    newValue: { status: updated.status, ownerUserId: updated.owner_user_id }, sourceIp: req.ip, correlationId: requestId(req),
  });
  res.json({ exception: serializeException(updated) });
}));

const podSchema = z.object({
  storageReference: z.string().trim().min(1).max(255).regex(/^[A-Za-z0-9._/-]+$/, 'storageReference contains unsupported characters')
    .refine((value) => !value.includes('..'), 'storageReference must not contain path traversal'),
  originalFilename: z.string().trim().min(1).max(180).optional(),
  contentType: z.enum(['application/pdf', 'image/jpeg', 'image/png']),
  byteSize: z.number().int().positive().max(25 * 1024 * 1024),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/i, 'checksumSha256 must be a SHA-256 hex digest'),
  idempotencyKey: z.string().trim().min(8).max(160),
});
operationsRouter.post('/shipments/:id/pods', requirePermission('record_pod'), asyncHandler(async (req, res) => {
  const body = podSchema.parse(req.body);
  const shipment = await getShipment(req.params.id, req.user!.tenantId);
  if (!(['delivered', 'pod_confirmed', 'closed'] as string[]).includes(shipment.status)) {
    throw new HttpError(409, 'POD may only be recorded after delivery');
  }
  const digest = payloadDigest({ shipmentId: shipment.id, ...body });
  const outcome = await db.transaction(async (trx) => {
    const claim = await claimIdempotency(trx, req.user!.tenantId, `shipment_pod:${shipment.id}`, body.idempotencyKey, digest);
    if (claim.replay) {
      const existing = await trx('shipment_pods').where({ tenant_id: req.user!.tenantId, shipment_id: shipment.id, checksum_sha256: body.checksumSha256 }).first();
      return { replay: true, pod: existing };
    }
    const delivery = await trx('logistics_events').where({ tenant_id: req.user!.tenantId, shipment_id: shipment.id, event_type: 'shipment.delivered' }).orderBy('occurred_at', 'desc').first();
    const pod = {
      id: operationId('pod'), tenant_id: req.user!.tenantId, shipment_id: shipment.id, delivery_event_id: delivery?.id ?? null,
      status: 'received', storage_reference: body.storageReference, original_filename: body.originalFilename ?? null,
      content_type: body.contentType, byte_size: body.byteSize, checksum_sha256: body.checksumSha256.toLowerCase(), uploaded_by: req.user!.id,
    };
    await trx('shipment_pods').insert(pod);
    if (shipment.status === 'delivered') await trx('shipments').where({ id: shipment.id, tenant_id: req.user!.tenantId }).update({ status: 'pod_confirmed', updated_by: req.user!.id, updated_at: trx.fn.now() });
    const evidence = { podId: pod.id, checksum: pod.checksum_sha256, contentType: pod.content_type, byteSize: pod.byte_size };
    await trx('logistics_events').insert({
      id: operationId('event'), tenant_id: req.user!.tenantId, shipment_id: shipment.id, event_type: 'pod.received',
      occurred_at: new Date().toISOString(), source_system: 'logix.operator', source_record_id: pod.id,
      correlation_id: requestId(req), idempotency_key: `pod-event:${body.idempotencyKey}`, payload_digest: digest,
      payload: JSON.stringify(evidence), actor_user_id: req.user!.id,
    });
    return { replay: false, pod };
  });
  if (!outcome.pod) throw new HttpError(409, 'POD idempotency record exists without a POD artifact');
  if (!outcome.replay) await audit({
    action: 'shipment_pod_recorded', userId: req.user!.id, tenantId: req.user!.tenantId, entityType: 'shipment_pod', entityId: outcome.pod.id,
    newValue: { shipmentId: shipment.id, contentType: body.contentType, byteSize: body.byteSize }, sourceIp: req.ip, correlationId: requestId(req),
  });
  res.status(outcome.replay ? 200 : 201).json({ idempotent: outcome.replay, pod: serializePod(outcome.pod) });
}));

operationsRouter.get('/shipments/:shipmentId/pods/:podId', requirePermission('view_operations'), asyncHandler(async (req, res) => {
  const pod = await db('shipment_pods').where({ id: req.params.podId, shipment_id: req.params.shipmentId, tenant_id: req.user!.tenantId }).first();
  if (!pod) throw new HttpError(404, 'POD not found');
  res.json({ pod: serializePod(pod) });
}));

const chargeSchema = z.object({
  providerId: idSchema.optional(),
  chargeType: z.string().trim().min(1).max(80),
  amount: z.number().finite().nonnegative(),
  currency: z.string().trim().regex(/^[A-Za-z]{3}$/),
  chargeBasis: z.enum(['expected', 'actual']).default('actual'),
  invoiceNumber: z.string().trim().min(1).max(160).optional(),
  sourceSystem: z.string().trim().min(1).max(80).default('logix.operator'),
  sourceRecordId: z.string().trim().min(1).max(160),
  invoicedAt: timestampSchema.optional(),
});
operationsRouter.post('/shipments/:id/charges', requirePermission('manage_operations'), asyncHandler(async (req, res) => {
  const body = chargeSchema.parse(req.body);
  const shipment = await getShipment(req.params.id, req.user!.tenantId);
  if (body.providerId) await getProvider(body.providerId, req.user!.tenantId);
  const charge = {
    id: operationId('charge'), tenant_id: req.user!.tenantId, shipment_id: shipment.id, provider_id: body.providerId ?? shipment.provider_id ?? null,
    charge_type: body.chargeType, amount: body.amount, currency: body.currency.toUpperCase(), charge_basis: body.chargeBasis,
    invoice_number: body.invoiceNumber ?? null, source_system: body.sourceSystem, source_record_id: body.sourceRecordId,
    invoiced_at: body.invoicedAt ? asUtcIso(body.invoicedAt, 'invoicedAt') : null,
  };
  try {
    await db('freight_charges').insert(charge);
  } catch (error) {
    if (isUniqueViolation(error)) throw new HttpError(409, 'Freight charge source record already exists in this tenant');
    throw error;
  }
  await audit({
    action: 'freight_charge_recorded', userId: req.user!.id, tenantId: req.user!.tenantId, entityType: 'freight_charge', entityId: charge.id,
    newValue: { shipmentId: shipment.id, chargeType: body.chargeType, currency: charge.currency, chargeBasis: body.chargeBasis }, sourceIp: req.ip, correlationId: requestId(req),
  });
  res.status(201).json({ charge: serializeCharge(charge) });
}));

operationsRouter.get('/intelligence', requirePermission('view_operations'), asyncHandler(async (req, res) => {
  const rangeSchema = z.object({ start: timestampSchema.optional(), end: timestampSchema.optional() });
  const range = rangeSchema.parse(req.query);
  const start = range.start ? asUtcIso(range.start, 'start') : '1970-01-01T00:00:00.000Z';
  const end = range.end ? asUtcIso(range.end, 'end') : '2100-01-01T00:00:00.000Z';
  if (Date.parse(start) > Date.parse(end)) throw new HttpError(422, 'start must not be after end');
  const shipments = await db('shipments as s')
    .leftJoin('logistics_providers as p', function joinProvider() { this.on('s.provider_id', '=', 'p.id').andOn('p.tenant_id', '=', 's.tenant_id'); })
    .where('s.tenant_id', req.user!.tenantId)
    .select('s.*', 'p.code as provider_code');
  const charges = await db('freight_charges as c')
    .leftJoin('shipments as s', function joinShipment() { this.on('c.shipment_id', '=', 's.id').andOn('c.tenant_id', '=', 's.tenant_id'); })
    .leftJoin('logistics_providers as p', function joinProvider() { this.on('c.provider_id', '=', 'p.id').andOn('c.tenant_id', '=', 'p.tenant_id'); })
    .where('c.tenant_id', req.user!.tenantId)
    .select('c.*', 's.origin_location_id', 's.destination_location_id', 's.project_reference', 's.customer_reference', 's.weight', 's.weight_uom', 'p.code as provider_code');
  const carrierPerformance = evaluateCarrierPerformance(shipments.filter((s) => s.provider_code).map((shipment) => ({
    sourceRecordId: shipment.id, shipmentId: shipment.id, carrierCode: shipment.provider_code,
    plannedPickupAt: shipment.planned_pickup_at, actualPickupAt: shipment.actual_pickup_at,
    plannedDeliveryAt: shipment.planned_delivery_at, actualDeliveryAt: shipment.actual_delivery_at,
    cancelled: shipment.status === 'cancelled',
  })), { dateWindow: { start, end } });
  const transportSpend = analyzeTransportSpend(charges.map((charge) => ({
    sourceRowId: charge.id, shipmentId: charge.shipment_id, amount: Number(charge.amount), currency: charge.currency,
    carrierCode: charge.provider_code ?? null, origin: charge.origin_location_id ?? null, destination: charge.destination_location_id ?? null,
    project: charge.project_reference ?? null, customer: charge.customer_reference ?? null, chargeType: charge.charge_type,
    invoiceNumber: charge.invoice_number ?? null,
  })), shipments.map((shipment) => ({ shipmentId: shipment.id, weight: shipment.weight == null ? null : Number(shipment.weight), weightUnit: shipment.weight_uom ?? null })));
  const openExceptions = await db('logistics_exceptions').where({ tenant_id: req.user!.tenantId }).whereNotIn('status', ['resolved', 'dismissed'])
    .orderBy([{ column: 'severity', order: 'asc' }, { column: 'created_at', order: 'desc' }]).limit(50);
  res.json({
    dateWindow: { start, end }, carrierPerformance, transportSpend,
    shipmentRisk: { status: 'not_available', reason: 'MVP 1 requires governed availability and material-requirement inputs before material/shipment risk can be calculated.' },
    openExceptions: openExceptions.map(serializeException),
  });
}));

function parseJson(value: unknown, fallback: unknown) {
  if (!value || typeof value !== 'string') return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

function serializeProvider(row: Record<string, unknown>) {
  return { id: row.id, code: row.code, name: row.name, providerType: row.provider_type, status: row.status, serviceTypes: parseJson(row.service_types, []), externalSystem: row.external_system ?? null, externalId: row.external_id ?? null, contractReference: row.contract_reference ?? null, createdAt: row.created_at, updatedAt: row.updated_at };
}
function serializeRequirement(row: Record<string, unknown>) {
  return { id: row.id, requirementNumber: row.requirement_number, status: row.status, originLocationId: row.origin_location_id ?? null, destinationLocationId: row.destination_location_id ?? null, requiredDeliveryAt: row.required_delivery_at ?? null, orderReference: row.order_reference ?? null, projectReference: row.project_reference ?? null, wbsReference: row.wbs_reference ?? null, sourceSystem: row.source_system ?? null, sourceRecordId: row.source_record_id ?? null, description: row.description ?? null, createdAt: row.created_at, updatedAt: row.updated_at };
}
function serializeShipment(row: Record<string, unknown>) {
  return { id: row.id, shipmentNumber: row.shipment_number, transportRequirementId: row.transport_requirement_id ?? null, providerId: row.provider_id ?? null, providerCode: row.provider_code ?? null, providerName: row.provider_name ?? null, providerType: row.provider_type ?? null, status: row.status, mode: row.mode ?? null, originLocationId: row.origin_location_id, destinationLocationId: row.destination_location_id, plannedPickupAt: row.planned_pickup_at ?? null, actualPickupAt: row.actual_pickup_at ?? null, plannedDeliveryAt: row.planned_delivery_at ?? null, actualDeliveryAt: row.actual_delivery_at ?? null, requiredDeliveryAt: row.required_delivery_at ?? null, trackingNumber: row.tracking_number ?? null, weight: row.weight == null ? null : Number(row.weight), weightUom: row.weight_uom ?? null, customerReference: row.customer_reference ?? null, projectReference: row.project_reference ?? null, createdAt: row.created_at, updatedAt: row.updated_at };
}
function serializeLeg(row: Record<string, unknown>) { return { id: row.id, sequence: row.sequence, mode: row.mode ?? null, providerId: row.provider_id ?? null, originLocationId: row.origin_location_id, destinationLocationId: row.destination_location_id, plannedDepartureAt: row.planned_departure_at ?? null, actualDepartureAt: row.actual_departure_at ?? null, plannedArrivalAt: row.planned_arrival_at ?? null, actualArrivalAt: row.actual_arrival_at ?? null }; }
function serializeReference(row: Record<string, unknown>) { return { id: row.id, type: row.reference_type, value: row.reference_value, sourceSystem: row.source_system ?? null, sourceRecordId: row.source_record_id ?? null }; }
function serializeEvent(row: Record<string, unknown>) { return { id: row.id, shipmentId: row.shipment_id, shipmentLegId: row.shipment_leg_id ?? null, eventType: row.event_type, occurredAt: row.occurred_at, recordedAt: row.recorded_at ?? row.created_at, sourceSystem: row.source_system, sourceRecordId: row.source_record_id, correlationId: row.correlation_id, causationId: row.causation_id ?? null, payload: parseJson(row.payload, null) }; }
function serializeException(row: Record<string, unknown>) { return { id: row.id, shipmentId: row.shipment_id, eventId: row.event_id ?? null, exceptionType: row.exception_type, severity: row.severity, status: row.status, title: row.title, description: row.description ?? null, ownerUserId: row.owner_user_id ?? null, slaDueAt: row.sla_due_at ?? null, impactReferences: parseJson(row.impact_references, []), recommendedAction: row.recommended_action ?? null, resolutionNote: row.resolution_note ?? null, resolvedAt: row.resolved_at ?? null, createdAt: row.created_at, updatedAt: row.updated_at }; }
function serializePod(row: Record<string, unknown>) { return { id: row.id, shipmentId: row.shipment_id, status: row.status, storageReference: row.storage_reference, originalFilename: row.original_filename ?? null, contentType: row.content_type, byteSize: Number(row.byte_size), checksumSha256: row.checksum_sha256, createdAt: row.created_at }; }
function serializeCharge(row: Record<string, unknown>) { return { id: row.id, shipmentId: row.shipment_id, providerId: row.provider_id ?? null, chargeType: row.charge_type, amount: Number(row.amount), currency: row.currency, chargeBasis: row.charge_basis, invoiceNumber: row.invoice_number ?? null, sourceSystem: row.source_system, sourceRecordId: row.source_record_id, invoicedAt: row.invoiced_at ?? null, createdAt: row.created_at }; }
