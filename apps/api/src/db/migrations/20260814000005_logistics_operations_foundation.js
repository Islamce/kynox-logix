/**
 * Additive KYNOX Logix MVP 1 operations foundation.
 *
 * The tables in this migration are intentionally tenant-scoped and do not
 * modify WMS, ERP, R4C, or existing inventory-diagnostic tables. External
 * identifiers are retained as references/provenance, while Logix owns the
 * canonical operational records defined here.
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('logistics_providers', (t) => {
    t.string('id', 64).primary();
    t.string('tenant_id', 64).notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.string('code', 80).notNullable();
    t.string('name', 180).notNullable();
    t.string('provider_type', 24).notNullable(); // carrier | 3pl | forwarder
    t.string('status', 24).notNullable().defaultTo('active');
    t.text('service_types').nullable();
    t.string('external_system', 80).nullable();
    t.string('external_id', 160).nullable();
    t.string('contract_reference', 160).nullable();
    t.datetime('created_at').notNullable().defaultTo(knex.fn.now());
    t.datetime('updated_at').notNullable().defaultTo(knex.fn.now());
    t.unique(['tenant_id', 'code']);
    t.index(['tenant_id', 'status']);
    t.index(['tenant_id', 'external_system', 'external_id']);
  });

  await knex.schema.createTable('transport_requirements', (t) => {
    t.string('id', 64).primary();
    t.string('tenant_id', 64).notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.string('requirement_number', 100).notNullable();
    t.string('status', 24).notNullable().defaultTo('draft');
    t.string('origin_location_id', 120).nullable();
    t.string('destination_location_id', 120).nullable();
    t.datetime('required_delivery_at').nullable();
    t.string('order_reference', 160).nullable();
    t.string('project_reference', 160).nullable();
    t.string('wbs_reference', 160).nullable();
    t.string('source_system', 80).nullable();
    t.string('source_record_id', 160).nullable();
    t.text('description').nullable();
    t.integer('created_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    t.datetime('created_at').notNullable().defaultTo(knex.fn.now());
    t.datetime('updated_at').notNullable().defaultTo(knex.fn.now());
    t.unique(['tenant_id', 'requirement_number']);
    t.index(['tenant_id', 'status']);
    t.index(['tenant_id', 'source_system', 'source_record_id']);
  });

  await knex.schema.createTable('shipments', (t) => {
    t.string('id', 64).primary();
    t.string('tenant_id', 64).notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.string('shipment_number', 100).notNullable();
    t.string('transport_requirement_id', 64).nullable().references('id').inTable('transport_requirements').onDelete('SET NULL');
    t.string('provider_id', 64).nullable().references('id').inTable('logistics_providers').onDelete('SET NULL');
    t.string('status', 24).notNullable().defaultTo('planned');
    t.string('mode', 24).nullable();
    t.string('origin_location_id', 120).notNullable();
    t.string('destination_location_id', 120).notNullable();
    t.datetime('planned_pickup_at').nullable();
    t.datetime('actual_pickup_at').nullable();
    t.datetime('planned_delivery_at').nullable();
    t.datetime('actual_delivery_at').nullable();
    t.datetime('required_delivery_at').nullable();
    t.string('tracking_number', 160).nullable();
    t.decimal('weight', 15, 4).nullable();
    t.string('weight_uom', 16).nullable();
    t.string('customer_reference', 160).nullable();
    t.string('project_reference', 160).nullable();
    t.integer('created_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    t.integer('updated_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    t.datetime('created_at').notNullable().defaultTo(knex.fn.now());
    t.datetime('updated_at').notNullable().defaultTo(knex.fn.now());
    t.unique(['tenant_id', 'shipment_number']);
    t.index(['tenant_id', 'status']);
    t.index(['tenant_id', 'provider_id']);
    t.index(['tenant_id', 'transport_requirement_id']);
  });

  await knex.schema.createTable('shipment_legs', (t) => {
    t.string('id', 64).primary();
    t.string('tenant_id', 64).notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.string('shipment_id', 64).notNullable().references('id').inTable('shipments').onDelete('CASCADE');
    t.integer('sequence').notNullable();
    t.string('mode', 24).nullable();
    t.string('provider_id', 64).nullable().references('id').inTable('logistics_providers').onDelete('SET NULL');
    t.string('origin_location_id', 120).notNullable();
    t.string('destination_location_id', 120).notNullable();
    t.datetime('planned_departure_at').nullable();
    t.datetime('actual_departure_at').nullable();
    t.datetime('planned_arrival_at').nullable();
    t.datetime('actual_arrival_at').nullable();
    t.datetime('created_at').notNullable().defaultTo(knex.fn.now());
    t.datetime('updated_at').notNullable().defaultTo(knex.fn.now());
    t.unique(['tenant_id', 'shipment_id', 'sequence']);
    t.index(['tenant_id', 'shipment_id']);
  });

  await knex.schema.createTable('shipment_references', (t) => {
    t.increments('id').primary();
    t.string('tenant_id', 64).notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.string('shipment_id', 64).notNullable().references('id').inTable('shipments').onDelete('CASCADE');
    t.string('reference_type', 48).notNullable();
    t.string('reference_value', 255).notNullable();
    t.string('source_system', 80).nullable();
    t.string('source_record_id', 160).nullable();
    t.datetime('created_at').notNullable().defaultTo(knex.fn.now());
    t.unique(['tenant_id', 'shipment_id', 'reference_type', 'reference_value']);
    t.index(['tenant_id', 'reference_type', 'reference_value']);
  });

  await knex.schema.createTable('logistics_events', (t) => {
    t.string('id', 64).primary();
    t.string('tenant_id', 64).notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.string('shipment_id', 64).notNullable().references('id').inTable('shipments').onDelete('CASCADE');
    t.string('shipment_leg_id', 64).nullable().references('id').inTable('shipment_legs').onDelete('SET NULL');
    t.string('event_type', 80).notNullable();
    t.datetime('occurred_at').notNullable();
    t.datetime('recorded_at').notNullable().defaultTo(knex.fn.now());
    t.string('source_system', 80).notNullable();
    t.string('source_record_id', 160).notNullable();
    t.string('correlation_id', 80).notNullable();
    t.string('causation_id', 80).nullable();
    t.string('idempotency_key', 160).notNullable();
    t.string('payload_digest', 128).notNullable();
    t.text('payload').nullable();
    t.integer('actor_user_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    t.datetime('created_at').notNullable().defaultTo(knex.fn.now());
    t.unique(['tenant_id', 'source_system', 'source_record_id']);
    t.unique(['tenant_id', 'idempotency_key']);
    t.index(['tenant_id', 'shipment_id', 'occurred_at']);
    t.index(['tenant_id', 'event_type', 'occurred_at']);
  });

  await knex.schema.createTable('logistics_idempotency', (t) => {
    t.increments('id').primary();
    t.string('tenant_id', 64).notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.string('scope', 80).notNullable();
    t.string('idempotency_key', 160).notNullable();
    t.string('request_digest', 128).notNullable();
    t.string('entity_id', 64).nullable();
    t.datetime('created_at').notNullable().defaultTo(knex.fn.now());
    t.unique(['tenant_id', 'scope', 'idempotency_key']);
  });

  await knex.schema.createTable('logistics_exceptions', (t) => {
    t.string('id', 64).primary();
    t.string('tenant_id', 64).notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.string('shipment_id', 64).notNullable().references('id').inTable('shipments').onDelete('CASCADE');
    t.string('event_id', 64).nullable().references('id').inTable('logistics_events').onDelete('SET NULL');
    t.string('exception_type', 48).notNullable();
    t.string('severity', 16).notNullable();
    t.string('status', 24).notNullable().defaultTo('open');
    t.string('title', 200).notNullable();
    t.text('description').nullable();
    t.integer('owner_user_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    t.datetime('sla_due_at').nullable();
    t.text('impact_references').nullable();
    t.text('recommended_action').nullable();
    t.text('resolution_note').nullable();
    t.integer('resolved_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    t.datetime('resolved_at').nullable();
    t.integer('created_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    t.datetime('created_at').notNullable().defaultTo(knex.fn.now());
    t.datetime('updated_at').notNullable().defaultTo(knex.fn.now());
    t.index(['tenant_id', 'shipment_id']);
    t.index(['tenant_id', 'status', 'severity']);
  });

  await knex.schema.createTable('shipment_pods', (t) => {
    t.string('id', 64).primary();
    t.string('tenant_id', 64).notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.string('shipment_id', 64).notNullable().references('id').inTable('shipments').onDelete('CASCADE');
    t.string('delivery_event_id', 64).nullable().references('id').inTable('logistics_events').onDelete('SET NULL');
    t.string('status', 24).notNullable().defaultTo('received');
    t.string('storage_reference', 255).notNullable();
    t.string('original_filename', 180).nullable();
    t.string('content_type', 100).notNullable();
    t.integer('byte_size').unsigned().notNullable();
    t.string('checksum_sha256', 64).notNullable();
    t.integer('uploaded_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    t.datetime('created_at').notNullable().defaultTo(knex.fn.now());
    t.index(['tenant_id', 'shipment_id']);
  });

  await knex.schema.createTable('freight_charges', (t) => {
    t.string('id', 64).primary();
    t.string('tenant_id', 64).notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.string('shipment_id', 64).notNullable().references('id').inTable('shipments').onDelete('CASCADE');
    t.string('provider_id', 64).nullable().references('id').inTable('logistics_providers').onDelete('SET NULL');
    t.string('charge_type', 80).notNullable();
    t.decimal('amount', 15, 4).notNullable();
    t.string('currency', 3).notNullable();
    t.string('charge_basis', 16).notNullable().defaultTo('actual'); // expected | actual
    t.string('invoice_number', 160).nullable();
    t.string('source_system', 80).notNullable();
    t.string('source_record_id', 160).notNullable();
    t.datetime('invoiced_at').nullable();
    t.datetime('created_at').notNullable().defaultTo(knex.fn.now());
    t.unique(['tenant_id', 'source_system', 'source_record_id']);
    t.index(['tenant_id', 'shipment_id']);
    t.index(['tenant_id', 'currency']);
  });
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
  for (const table of [
    'freight_charges', 'shipment_pods', 'logistics_exceptions', 'logistics_idempotency',
    'logistics_events', 'shipment_references', 'shipment_legs', 'shipments',
    'transport_requirements', 'logistics_providers',
  ]) {
    await knex.schema.dropTableIfExists(table);
  }
};
