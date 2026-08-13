# Logix Canonical KPI Registry

**Status:** Canonical definition source for KYNOX logistics and linked inventory intelligence.  
**Version:** `1.0.0`  
**Timezone policy:** Operational event timestamps are stored in UTC. Reporting timezone must be selected explicitly by tenant policy and shown with every time-windowed KPI.

> No controller, UI component, spreadsheet or AI prompt may define an independent KPI formula. Deterministic implementations belong in a versioned engine or governed query that cites this registry.

## Logistics operations KPIs

| KPI | Definition / numerator | Denominator | Inclusion and exclusion | Time basis / source | Owner |
|---|---|---|---|---|---|
| OTIF | Shipments delivered on or before required delivery time **and** complete according to available delivery evidence. | Eligible delivered shipments. | Exclude cancelled shipments and records missing a required delivery time; report missing-completeness evidence separately. | Delivery actual vs required time; shipment/event evidence. | Logistics Operations |
| On-time pickup | Shipments with actual pickup at or before planned pickup plus approved tolerance. | Eligible shipments with planned and actual pickup. | Exclude cancelled/no-plan/no-actual rows; never treat missing actual as on-time. | Pickup event timestamps. | Logistics Operations |
| On-time delivery | Shipments with actual delivery at or before planned/required delivery plus approved tolerance. | Eligible delivered shipments with target and actual delivery. | Exclude cancelled/no-target/no-actual rows; publish exclusions. | Delivery event timestamps. | Logistics Operations |
| Tender acceptance rate | Accepted valid tender responses. | Valid tender responses received. | MVP 1 is `not_available`; no fabricated baseline before tender model exists. | Tender response time; future Logix domain. | Logistics Operations |
| Carrier acceptance rate | Provider acceptances. | Provider assignment/tender invitations requiring acceptance. | MVP 1 uses assignment only; report `not_available` until response semantics exist. | Provider response records; future domain. | Logistics Operations |
| Freight cost per shipment | Total eligible freight charge amount, grouped by currency. | Eligible shipment count in same currency grouping. | Never sum across currencies; exclude void/disputed policy-defined charges. | Freight charge evidence. | Logistics Finance / Operations |
| Freight cost per ton | Total eligible freight charge amount by currency. | Eligible recorded shipment weight in tons. | `not_available` when weight absent/zero; do not infer units. | Freight charge and shipment weight evidence. | Logistics Finance / Operations |
| Cost variance | Actual eligible charge amount minus expected eligible charge amount, same currency. | Expected amount where percentage displayed. | `not_available` if expected cost absent; preserve charge-type scope. | Charge evidence / rate context. | Logistics Finance / Operations |
| Invoice accuracy | Invoices/charges within approved variance tolerance. | Reviewed invoices/charges with expected value. | MVP 1 may surface operational charge variance only; financial posting remains ERP authority. | Charge/invoice reference. | Logistics Finance / Operations |
| Claim rate | Eligible shipments/charges with open or resolved claim. | Eligible delivered shipments or reviewed charges; basis must be stated. | MVP 1 is `not_available` until claim entity exists. | Future claim workflow. | Logistics Operations |
| Average delay | Sum of positive actual delivery minus target duration. | Delivered shipments with target and actual delivery. | Negative/early duration is zero for delay numerator; exclude invalid chronology. | Shipment/milestone events. | Logistics Operations |
| Carrier performance score | Explicit weighted combination of on-time pickup, on-time delivery, OTIF, transit variance, claim/damage and failed-delivery metrics. | Not applicable; score components are published. | No score is valid without weight version and component availability. | `packages/logistics-engine` evidence contracts. | Shared Intelligence |

## Linked inventory and materials KPIs

| KPI | Definition / numerator | Denominator | Inclusion and exclusion | Time basis / source | Owner |
|---|---|---|---|---|---|
| Inventory turns | Cost of eligible consumption over period. | Average inventory value for same period. | Exclude unsupported valuation and non-comparable currencies unless approved. | Inventory canonical transactions. | Shared Intelligence |
| Days on hand | Current eligible inventory quantity/value. | Average daily eligible consumption. | `not_available` for zero/unknown demand; document material/location scope. | Stock and movement evidence. | Shared Intelligence |
| Dead stock | Inventory with no eligible movement for policy threshold. | Optional total stock quantity/value. | Threshold and movement types are versioned policy inputs. | Inventory movements/stock. | Shared Intelligence |
| Excess | Stock above documented reference quantity or coverage target. | Not applicable; ratio can use stock/reference. | Method/version is mandatory. | Analytics engine. | Shared Intelligence |
| Stockout risk | Material/location demand exposure based on stock, reservations, confirmed inbound and required date. | Not applicable; categorical risk. | Requires source-quality and lead-time limitations. | Risk engine plus WMS/Logix evidence. | Shared Intelligence |

## Common registry fields

Every implementation must record the following metadata with an emitted metric:

| Field | Requirement |
|---|---|
| `kpi_key` | Stable registry key. |
| `definition_version` | `1.0.0` for this registry unless explicitly superseded. |
| `calculation_version` | Package/query release identifier. |
| `numerator` and `denominator` | Returned or reconstructable for ratio KPIs. |
| `inclusion_rule` and `exclusion_rule` | Explicit scope. |
| `period_start`, `period_end`, `timezone` | Required for time-windowed measures. |
| `source` | Entity types, source systems and evidence window. |
| `owner` | Accountable business function. |
| `data_limitations` | Required whenever source fields or denominators are incomplete. |

## Implementation mapping

| Registry area | Initial implementation location | Constraint |
|---|---|---|
| Carrier timing/performance | `packages/logistics-engine/src/carrier-performance.ts` | Preserve pure-function contracts; add canonical wrappers/tests rather than UI formulas. |
| Transport spend | `packages/logistics-engine/src/spend.ts` | Group by currency and state limitations. |
| Shipment/material risk | `packages/logistics-engine/src/risk.ts` | Treat risk as an evidence-backed finding, not shipment-state authority. |
| Inventory metrics | `packages/analytics-engine/src/*` | Keep outside Logix operational write model. |
| Presentation | API response and operator UI | Display formula/version/limitations; no calculation duplication. |

## Versioning and change control

Any formula change requires a registry version, deterministic test update, migration note for historical comparison and documentation of the changed inclusion/exclusion logic. A changed formula must never overwrite a historical KPI result without preserving the calculation version.

## Evidence references

- [Carrier performance engine](../../packages/logistics-engine/src/carrier-performance.ts)
- [Transport spend engine](../../packages/logistics-engine/src/spend.ts)
- [Risk engine](../../packages/logistics-engine/src/risk.ts)
- [Inventory analytics engine](../../packages/analytics-engine/src/index.ts)
- [Existing KPI dictionary](../../docs/KPI_DICTIONARY.md)
