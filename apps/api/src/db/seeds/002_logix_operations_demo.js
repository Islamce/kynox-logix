const crypto = require('crypto');

const id = (prefix) => `${prefix}_${crypto.randomUUID()}`;

/**
 * Development/UAT-only Logix operations fixture. It contains fictional provider,
 * shipment and evidence data and is intentionally idempotent. Production seed
 * execution is prohibited by the documented deployment configuration.
 * @param {import('knex').Knex} knex
 */
exports.seed = async function seed(knex) {
  const tenantId = 'legacy-default';
  const alreadySeeded = await knex('shipments').where({ tenant_id: tenantId, shipment_number: 'DEMO-LOGIX-1001' }).first();
  if (alreadySeeded) return;

  const admin = await knex('users').where({ email: process.env.ADMIN_EMAIL || 'admin@kynox.io' }).first('id');
  if (!admin) throw new Error('Logix demo seed requires the initial administrator seed');

  const provider = {
    id: id('provider'), tenant_id: tenantId, code: 'DEMO-CARRIER', name: 'Demo Carrier Services',
    provider_type: 'carrier', status: 'active', service_types: JSON.stringify(['road']),
    external_system: 'demo', external_id: 'carrier-001', contract_reference: 'DEMO-CONTRACT-01',
  };
  const requirement = {
    id: id('tr'), tenant_id: tenantId, requirement_number: 'DEMO-TR-1001', status: 'planned',
    origin_location_id: 'DEMO-WMS-01', destination_location_id: 'DEMO-SITE-01',
    required_delivery_at: '2026-10-04T12:00:00.000Z', project_reference: 'DEMO-R4C-01', wbs_reference: 'DEMO-WBS-01',
    source_system: 'demo-r4c', source_record_id: 'demo-requirement-01', description: 'Fictional UAT logistics requirement.', created_by: admin.id,
  };
  const deliveredShipment = {
    id: id('shipment'), tenant_id: tenantId, shipment_number: 'DEMO-LOGIX-1001', transport_requirement_id: requirement.id,
    provider_id: provider.id, status: 'pod_confirmed', mode: 'road', origin_location_id: 'DEMO-WMS-01', destination_location_id: 'DEMO-SITE-01',
    planned_pickup_at: '2026-10-01T08:00:00.000Z', actual_pickup_at: '2026-10-01T08:20:00.000Z',
    planned_delivery_at: '2026-10-03T16:00:00.000Z', actual_delivery_at: '2026-10-03T15:40:00.000Z',
    required_delivery_at: '2026-10-04T12:00:00.000Z', tracking_number: 'DEMO-TRACK-1001', weight: 1250, weight_uom: 'kg',
    customer_reference: 'DEMO-CUSTOMER-01', project_reference: 'DEMO-R4C-01', created_by: admin.id, updated_by: admin.id,
  };
  const activeShipment = {
    id: id('shipment'), tenant_id: tenantId, shipment_number: 'DEMO-LOGIX-1002', provider_id: provider.id,
    status: 'in_transit', mode: 'road', origin_location_id: 'DEMO-WMS-02', destination_location_id: 'DEMO-SITE-02',
    planned_pickup_at: '2026-10-04T08:00:00.000Z', actual_pickup_at: '2026-10-04T09:10:00.000Z',
    planned_delivery_at: '2026-10-05T14:00:00.000Z', required_delivery_at: '2026-10-05T18:00:00.000Z',
    tracking_number: 'DEMO-TRACK-1002', weight: 800, weight_uom: 'kg', created_by: admin.id, updated_by: admin.id,
  };

  await knex.transaction(async (trx) => {
    await trx('logistics_providers').insert(provider);
    await trx('transport_requirements').insert(requirement);
    await trx('shipments').insert([deliveredShipment, activeShipment]);
    await trx('shipment_references').insert({
      tenant_id: tenantId, shipment_id: deliveredShipment.id, reference_type: 'project', reference_value: 'DEMO-R4C-01', source_system: 'demo-r4c', source_record_id: 'demo-requirement-01',
    });
    const deliveryEventId = id('event');
    const events = [
      ['shipment.created', '2026-10-01T07:00:00.000Z', deliveredShipment.id, 'event-demo-1001-created'],
      ['shipment.picked_up', deliveredShipment.actual_pickup_at, deliveredShipment.id, 'event-demo-1001-pickup'],
      ['shipment.delivered', deliveredShipment.actual_delivery_at, deliveredShipment.id, 'event-demo-1001-delivery'],
      ['pod.received', '2026-10-03T16:00:00.000Z', deliveredShipment.id, 'event-demo-1001-pod'],
      ['shipment.created', '2026-10-04T07:00:00.000Z', activeShipment.id, 'event-demo-1002-created'],
      ['shipment.picked_up', activeShipment.actual_pickup_at, activeShipment.id, 'event-demo-1002-pickup'],
      ['shipment.departed', '2026-10-04T10:00:00.000Z', activeShipment.id, 'event-demo-1002-departure'],
    ].map(([eventType, occurredAt, shipmentId, sourceRecordId]) => ({
      id: eventType === 'shipment.delivered' ? deliveryEventId : id('event'), tenant_id: tenantId, shipment_id: shipmentId,
      event_type: eventType, occurred_at: occurredAt, source_system: 'demo', source_record_id: sourceRecordId,
      correlation_id: `demo-${shipmentId}`, idempotency_key: sourceRecordId, payload_digest: crypto.createHash('sha256').update(sourceRecordId).digest('hex'),
      payload: JSON.stringify({ fixture: true }), actor_user_id: admin.id,
    }));
    await trx('logistics_events').insert(events);
    await trx('shipment_pods').insert({
      id: id('pod'), tenant_id: tenantId, shipment_id: deliveredShipment.id, delivery_event_id: deliveryEventId,
      status: 'received', storage_reference: 'demo/legacy-default/pods/demo-logix-1001.pdf', original_filename: 'demo-logix-1001.pdf',
      content_type: 'application/pdf', byte_size: 1024, checksum_sha256: crypto.createHash('sha256').update('demo-logix-1001').digest('hex'), uploaded_by: admin.id,
    });
    await trx('logistics_exceptions').insert({
      id: id('exception'), tenant_id: tenantId, shipment_id: activeShipment.id, exception_type: 'pickup_delay', severity: 'medium', status: 'open',
      title: 'Demo pickup delay', description: 'Fictional UAT exception for the operator work queue.', owner_user_id: admin.id,
      sla_due_at: '2026-10-04T16:00:00.000Z', impact_references: JSON.stringify([{ type: 'project', value: 'DEMO-R4C-01' }]),
      recommended_action: 'Confirm revised ETA with the demo carrier.', created_by: admin.id,
    });
    await trx('freight_charges').insert([
      { id: id('charge'), tenant_id: tenantId, shipment_id: deliveredShipment.id, provider_id: provider.id, charge_type: 'base_freight', amount: 980, currency: 'AED', charge_basis: 'expected', source_system: 'demo', source_record_id: 'demo-charge-1001-expected' },
      { id: id('charge'), tenant_id: tenantId, shipment_id: deliveredShipment.id, provider_id: provider.id, charge_type: 'base_freight', amount: 995, currency: 'AED', charge_basis: 'actual', invoice_number: 'DEMO-INV-1001', source_system: 'demo', source_record_id: 'demo-charge-1001-actual', invoiced_at: '2026-10-04T09:00:00.000Z' },
    ]);
  });
};
