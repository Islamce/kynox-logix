# Control Tower Readiness

**Status:** Future-capability architecture policy.  
**Decision:** Do not build a separate Control Tower product or dashboard in this phase. Build the identifiers, operational facts, events, exceptions, provenance and integration contracts that make a future operational cockpit possible.

> A KYNOX Operations Control Tower is a future **operational cockpit**, not a collection of charts. It must expose cross-domain facts, recommended actions and governed approvals without displacing the systems that own those facts.

## Required future cockpit view

| Cross-domain concern | Current/future authoritative source | Control Tower presentation requirement | This branch's readiness contribution |
|---|---|---|---|
| Orders and delivery requirements | ERP / R4C / Logix transport requirement | Demand and required-date context. | External-reference model and transport requirement identity. |
| Inventory and reservations | WMS / shared intelligence | Availability, reservation and material-risk evidence. | Read-only WMS contract and provenance references. |
| Shipments and legs | Logix | Lifecycle, location, provider, ETA/tracking and delivery facts. | Tenant-scoped operational Logix model. |
| Providers | Logix | Carrier/3PL status, performance and capacity context. | Provider entity and assignment evidence. |
| Projects / WBS | R4C | Required-at-site date and project/business impact. | R4C bridge identifiers and status/impact contract. |
| Exceptions | Logix / source systems | Severity, owner, SLA, impact, recommendation and resolution. | First-class exception model and audit history. |
| Financial impact | ERP / Logix operational charges | Expected/actual cost, variance and claim/dispute context. | Shipment-charge relationship; no accounting duplication. |
| Recommended actions | Deterministic intelligence and governed AI | Evidence, confidence, assumptions and next action. | Deterministic/AI boundary and KPI governance. |
| Approvals | Respective operational system | Controlled action/approval record. | Audit/correlation and future workflow seam only. |

## Readiness requirements

| Requirement | Definition | MVP 1 implementation rule |
|---|---|---|
| Stable canonical identifiers | Cross-system entities can be linked without brittle string matching. | Use tenant-scoped IDs and separate external IDs/source references. |
| Audit-ready events | Operational facts identify source, entity, time, actor and correlation. | Persist normalized lifecycle and milestone events with provenance/idempotency. |
| First-class exceptions | Risks and failures have accountable workflow records, not passive alerts. | Link to shipment and optional material/order/inventory/project impact. |
| Fail-closed tenancy | Cross-tenant facts cannot be displayed or inferred. | Apply `tenant_id` to every new record and query; security tests must prove denial. |
| Deterministic KPI definitions | A cockpit does not invent formula variants. | Use the canonical KPI registry and existing engines. |
| Authority-preserving integration | Each system retains source-of-record responsibility. | WMS/R4C/ERP adapters are evidence/reference contracts, not shared writes. |
| Capability metadata | Diagnostic/public products can name capabilities without internal coupling. | Publish static capability metadata only when an interface is formalized. |

## Deferred decisions

The following decisions require later evidence and Founder/product authorization: Control Tower user personas, cross-product authorization model, action/approval routing, data-retention policy for long-lived events, real-time transport visibility provider selection, event-bus technology, FX normalization policy, project-impact calculation policy and intervention/escalation SLAs. They are not silently decided by this operational foundation.

## Readiness acceptance tests

A future Control Tower program may proceed only after the following evidence exists:

1. A shipment, provider, milestone, exception, POD and charge can be retrieved by canonical ID and tenant without joining client-side string fields.
2. WMS and R4C evidence can be correlated using a governed source reference and a documented mapping policy.
3. A duplicate or out-of-order event cannot corrupt the lifecycle timeline.
4. An exception carries owner, severity, lifecycle, impact linkage and audit history.
5. A KPI report can expose formula version and source window.
6. Cross-tenant and object-level authorization tests prove non-disclosure.
7. The operational UI is usable without a Control Tower dashboard.

## Non-goals

This branch does not add a control-tower navigation item, create a cross-product data lake, introduce a message broker, provide optimization recommendations, or deploy an executive dashboard. These would prematurely turn a readiness architecture into a new product.

## Evidence references

- [Canonical operations model](./CANONICAL_OPERATIONS_MODEL.md)
- [Integration architecture](./INTEGRATION_ARCHITECTURE.md)
- [Intelligence boundary](./INTELLIGENCE_CORE_BOUNDARY.md)
- [Existing Control Tower strategy record](../../../kynox-second-brain/07%20Systems/KYNOX%20Supply%20Chain%20Control%20Tower%20Architecture.md)
