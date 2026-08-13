import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import os from 'os';
import fs from 'fs';
import request from 'supertest';
import bcrypt from 'bcryptjs';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kynox-operations-test-'));
if (!process.env.DB_CLIENT || process.env.DB_CLIENT === 'better-sqlite3') {
  process.env.DB_CLIENT = 'better-sqlite3';
  process.env.DB_FILE = path.join(tmpDir, 'operations.sqlite');
}
process.env.JWT_SECRET = 'operations-test-secret';
process.env.UPLOAD_DIR = path.join(tmpDir, 'uploads');
process.env.EXPORT_DIR = path.join(tmpDir, 'exports');
process.env.AI_PROVIDER = 'none';

const { createApp } = await import('./app');
const { db } = await import('./db');
const app = createApp();

let managerToken = '';
let viewerToken = '';
let secondTenantToken = '';
let providerId = '';
let shipmentId = '';
let podId = '';

beforeAll(async () => {
  await db.migrate.latest();
  await db('tenants').insert({ id: 'tenant-b', code: 'tenant-b', name: 'Tenant B', status: 'active' });
  const users = [
    { email: 'operations-manager@kynox.io', name: 'Operations Manager', password: 'password-1', role: 'supply_chain_manager', tenant: 'legacy-default' },
    { email: 'operations-viewer@kynox.io', name: 'Operations Viewer', password: 'password-2', role: 'read_only', tenant: 'legacy-default' },
    { email: 'other-tenant-manager@kynox.io', name: 'Other Tenant Manager', password: 'password-3', role: 'supply_chain_manager', tenant: 'tenant-b' },
  ];
  for (const user of users) {
    await db('users').insert({ email: user.email, name: user.name, password_hash: bcrypt.hashSync(user.password, 8), role: user.role, active: true });
    const row = await db('users').where({ email: user.email }).first('id');
    await db('tenant_memberships').insert({ tenant_id: user.tenant, user_id: row.id, role: user.role, active: true, is_default: true });
  }
  const [manager, viewer, other] = await Promise.all([
    request(app).post('/api/auth/login').send({ email: 'operations-manager@kynox.io', password: 'password-1' }),
    request(app).post('/api/auth/login').send({ email: 'operations-viewer@kynox.io', password: 'password-2' }),
    request(app).post('/api/auth/login').send({ email: 'other-tenant-manager@kynox.io', password: 'password-3' }),
  ]);
  managerToken = manager.body.token;
  viewerToken = viewer.body.token;
  secondTenantToken = other.body.token;
});

afterAll(async () => {
  await db.destroy();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('Logix operations foundation', () => {
  it('enforces operations RBAC while allowing read-only operations visibility', async () => {
    const list = await request(app).get('/api/operations/shipments').set('Authorization', `Bearer ${viewerToken}`);
    expect(list.status).toBe(200);
    const denied = await request(app).post('/api/operations/providers').set('Authorization', `Bearer ${viewerToken}`).send({
      code: 'DENIED', name: 'Denied Carrier', providerType: 'carrier',
    });
    expect(denied.status).toBe(403);
  });

  it('creates a provider, a transport requirement and a shipment without duplicating WMS or R4C facts', async () => {
    const provider = await request(app).post('/api/operations/providers').set('Authorization', `Bearer ${managerToken}`).send({
      code: 'CAR-ALPHA', name: 'Alpha Freight', providerType: 'carrier', serviceTypes: ['road'], contractReference: 'ERP-CONTRACT-7',
    });
    expect(provider.status).toBe(201);
    providerId = provider.body.provider.id;

    const requirement = await request(app).post('/api/operations/transport-requirements').set('Authorization', `Bearer ${managerToken}`).send({
      requirementNumber: 'TR-1001', originLocationId: 'WMS-DXB', destinationLocationId: 'SITE-11',
      requiredDeliveryAt: '2026-09-03T12:00:00Z', projectReference: 'R4C-PROJECT-11', wbsReference: 'WBS-11', sourceSystem: 'r4c', sourceRecordId: 'REQ-11',
    });
    expect(requirement.status).toBe(201);

    const shipment = await request(app).post('/api/operations/shipments').set('Authorization', `Bearer ${managerToken}`).send({
      shipmentNumber: 'SHP-1001', transportRequirementId: requirement.body.transportRequirement.id,
      mode: 'road', originLocationId: 'WMS-DXB', destinationLocationId: 'SITE-11',
      plannedPickupAt: '2026-09-01T08:00:00Z', plannedDeliveryAt: '2026-09-02T17:00:00Z', requiredDeliveryAt: '2026-09-03T12:00:00Z',
      trackingNumber: 'TRACK-1001', weight: 1200, weightUom: 'kg',
      references: [{ type: 'project', value: 'R4C-PROJECT-11', sourceSystem: 'r4c', sourceRecordId: 'REQ-11' }],
      legs: [{ sequence: 1, mode: 'road', originLocationId: 'WMS-DXB', destinationLocationId: 'SITE-11', plannedDepartureAt: '2026-09-01T09:00:00Z', plannedArrivalAt: '2026-09-02T16:00:00Z' }],
    });
    expect(shipment.status).toBe(201);
    expect(shipment.body.shipment.status).toBe('planned');
    shipmentId = shipment.body.shipment.id;

    const assignment = await request(app).post(`/api/operations/shipments/${shipmentId}/assign-provider`).set('Authorization', `Bearer ${managerToken}`).send({ providerId, idempotencyKey: 'assign-provider-1001' });
    expect(assignment.status).toBe(201);
    expect(assignment.body.shipment.providerId).toBe(providerId);
    const assignmentReplay = await request(app).post(`/api/operations/shipments/${shipmentId}/assign-provider`).set('Authorization', `Bearer ${managerToken}`).send({ providerId, idempotencyKey: 'assign-provider-1001' });
    expect(assignmentReplay.status).toBe(200);
    expect(assignmentReplay.body.idempotent).toBe(true);
  });

  it('rejects invalid state transitions and then enforces the complete deterministic lifecycle', async () => {
    const invalid = await request(app).post(`/api/operations/shipments/${shipmentId}/transitions`).set('Authorization', `Bearer ${managerToken}`).send({
      status: 'delivered', occurredAt: '2026-09-02T17:00:00Z', idempotencyKey: 'invalid-transition-1001',
    });
    expect(invalid.status).toBe(409);

    const transitions: Array<[string, string, string]> = [
      ['booked', '2026-09-01T07:30:00Z', 'transition-booked-1001'],
      ['ready', '2026-09-01T07:45:00Z', 'transition-ready-1001'],
      ['picked_up', '2026-09-01T08:15:00Z', 'transition-picked-1001'],
      ['in_transit', '2026-09-01T09:00:00Z', 'transition-transit-1001'],
      ['arrived', '2026-09-02T16:30:00Z', 'transition-arrived-1001'],
      ['delivered', '2026-09-02T17:00:00Z', 'transition-delivered-1001'],
    ];
    for (const [status, occurredAt, idempotencyKey] of transitions) {
      const response = await request(app).post(`/api/operations/shipments/${shipmentId}/transitions`).set('Authorization', `Bearer ${managerToken}`).send({ status, occurredAt, idempotencyKey });
      expect(response.status).toBe(201);
      expect(response.body.shipment.status).toBe(status);
    }
  });

  it('records idempotent events, rejects altered replays, and refuses out-of-order chronology', async () => {
    const body = {
      eventType: 'tracking.updated', occurredAt: '2026-09-02T18:00:00Z', sourceSystem: 'carrier-alpha', sourceRecordId: 'TRACK-UPDATE-1',
      idempotencyKey: 'carrier-event-1001', payload: { location: 'SITE-11', confidence: 'high' },
    };
    const created = await request(app).post(`/api/operations/shipments/${shipmentId}/events`).set('Authorization', `Bearer ${managerToken}`).send(body);
    expect(created.status).toBe(201);
    const replay = await request(app).post(`/api/operations/shipments/${shipmentId}/events`).set('Authorization', `Bearer ${managerToken}`).send(body);
    expect(replay.status).toBe(200);
    expect(replay.body.idempotent).toBe(true);
    const altered = await request(app).post(`/api/operations/shipments/${shipmentId}/events`).set('Authorization', `Bearer ${managerToken}`).send({ ...body, payload: { location: 'SITE-12' } });
    expect(altered.status).toBe(409);
    const outOfOrder = await request(app).post(`/api/operations/shipments/${shipmentId}/events`).set('Authorization', `Bearer ${managerToken}`).send({
      eventType: 'tracking.updated', occurredAt: '2026-09-01T10:00:00Z', sourceSystem: 'carrier-alpha', sourceRecordId: 'TRACK-UPDATE-OLDER',
      idempotencyKey: 'carrier-event-older-1001', payload: { location: 'EN-ROUTE' },
    });
    expect(outOfOrder.status).toBe(422);
  });

  it('creates, resolves, and audits a first-class logistics exception', async () => {
    const created = await request(app).post(`/api/operations/shipments/${shipmentId}/exceptions`).set('Authorization', `Bearer ${managerToken}`).send({
      exceptionType: 'missing_pod', severity: 'high', title: 'Proof of delivery is missing',
      impactReferences: [{ type: 'project', value: 'R4C-PROJECT-11' }], recommendedAction: 'Obtain signed POD from carrier.',
    });
    expect(created.status).toBe(201);
    const resolved = await request(app).patch(`/api/operations/exceptions/${created.body.exception.id}`).set('Authorization', `Bearer ${managerToken}`).send({
      status: 'resolved', resolutionNote: 'Carrier supplied validated POD metadata.',
    });
    expect(resolved.status).toBe(200);
    expect(resolved.body.exception.status).toBe('resolved');
  });

  it('validates POD metadata, confirms POD state, and prevents cross-tenant POD disclosure', async () => {
    const forged = await request(app).post(`/api/operations/shipments/${shipmentId}/transitions`).set('Authorization', `Bearer ${managerToken}`).send({
      status: 'pod_confirmed', idempotencyKey: 'forged-pod-transition-1001',
    });
    expect(forged.status).toBe(422);
    const unsafe = await request(app).post(`/api/operations/shipments/${shipmentId}/pods`).set('Authorization', `Bearer ${managerToken}`).send({
      storageReference: '../../unsafe.txt', contentType: 'text/html', byteSize: 12, checksumSha256: 'a'.repeat(64), idempotencyKey: 'unsafe-pod-1001',
    });
    expect(unsafe.status).toBe(400);

    const pod = await request(app).post(`/api/operations/shipments/${shipmentId}/pods`).set('Authorization', `Bearer ${managerToken}`).send({
      storageReference: 'tenant/legacy-default/pods/SHP-1001.pdf', originalFilename: 'signed-pod.pdf', contentType: 'application/pdf', byteSize: 1024,
      checksumSha256: 'b'.repeat(64), idempotencyKey: 'pod-1001-valid',
    });
    expect(pod.status).toBe(201);
    expect(pod.body.pod.contentType).toBe('application/pdf');
    podId = pod.body.pod.id;

    const detail = await request(app).get(`/api/operations/shipments/${shipmentId}`).set('Authorization', `Bearer ${managerToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.shipment.status).toBe('pod_confirmed');

    const deniedShipment = await request(app).get(`/api/operations/shipments/${shipmentId}`).set('Authorization', `Bearer ${secondTenantToken}`);
    expect(deniedShipment.status).toBe(404);
    const deniedPod = await request(app).get(`/api/operations/shipments/${shipmentId}/pods/${podId}`).set('Authorization', `Bearer ${secondTenantToken}`);
    expect(deniedPod.status).toBe(404);
  });

  it('records operational charges and reuses deterministic provider/spend intelligence', async () => {
    const expected = await request(app).post(`/api/operations/shipments/${shipmentId}/charges`).set('Authorization', `Bearer ${managerToken}`).send({
      chargeType: 'base_freight', amount: 1000, currency: 'AED', chargeBasis: 'expected', sourceRecordId: 'EST-1001',
    });
    const actual = await request(app).post(`/api/operations/shipments/${shipmentId}/charges`).set('Authorization', `Bearer ${managerToken}`).send({
      chargeType: 'base_freight', amount: 1125, currency: 'AED', chargeBasis: 'actual', invoiceNumber: 'INV-1001', sourceRecordId: 'INV-1001',
    });
    expect(expected.status).toBe(201);
    expect(actual.status).toBe(201);
    const intelligence = await request(app).get('/api/operations/intelligence?start=2026-09-01T00:00:00Z&end=2026-09-30T23:59:59Z').set('Authorization', `Bearer ${managerToken}`);
    expect(intelligence.status).toBe(200);
    expect(intelligence.body.carrierPerformance).toHaveLength(1);
    expect(intelligence.body.transportSpend.totalsByCurrency[0].amount).toBe(2125);
    expect(intelligence.body.shipmentRisk.status).toBe('not_available');
  });
});
