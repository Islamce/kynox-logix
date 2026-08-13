<!-- KAAF-GENERATED — do not edit by hand. Regenerate with scripts/architecture/generate.sh. -->

# Flow — Operate a shipment from planning through POD evidence

Operate a shipment from planning through POD evidence — declared by `analytics-api` in `apps/api/kaaf.module.json`.

```mermaid
sequenceDiagram
  autonumber
  participant analytics_web as analytics-web
  participant logix_operations_api as logix-operations-api
  participant database as database
  participant analytics_logistics_engine as analytics-logistics-engine
  analytics_web->>logix_operations_api: create a tenant-scoped shipment and optional provider assignment
  logix_operations_api->>database: record controlled lifecycle milestones with provenance and idempotency
  analytics_web->>logix_operations_api: create or resolve an exception and record POD metadata
  logix_operations_api->>analytics_logistics_engine: calculate provider performance and transport spend from operational evidence
```
<!-- kaaf:bodyDigest=862f210d56fc2c9b4b266a3e558bafc750bd54beb017a8d4aa94d17666a1f2ff -->
