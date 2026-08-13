# Logix MVP Roadmap

**Status:** Controlled product and implementation roadmap.  
**Principle:** The roadmap advances only after evidence gates pass. It does not turn the long-term 4PL/5PL vision into immediate scope.

## MVP 1 — Logistics Visibility and Operations Foundation

**Outcome:** An authorized operator can create a shipment, assign a provider, record chronological milestones, detect and resolve an exception, confirm delivery, attach a POD reference and view deterministic provider/spend insight for their tenant.

| Capability | Included | Acceptance evidence |
|---|---|---|
| Tenant-aware operations model | Provider, transport requirement, shipment, legs, references, events, exceptions, POD and charge context are tenant-scoped. | Cross-tenant and IDOR tests fail closed. |
| RBAC and SoD basis | Operational permissions are enforced centrally with existing role matrix discipline. | Positive/negative route authorization tests. |
| Shipment lifecycle | Controlled status transitions from planned through closed/cancelled. | Unit tests for valid and invalid transitions. |
| Provider operations | Carrier/3PL/forwarder profile and shipment assignment. | Tenant-scoped provider/assignment tests. |
| Milestones and events | Idempotent, provenance-bearing events with chronology checks. | Duplicate, replay, stale and out-of-order tests. |
| Exception workflow | Severity, owner, SLA/impact context, resolution and audit. | Lifecycle, assignment and resolution tests. |
| POD | Validated metadata/reference and authorized retrieval policy. | Invalid upload/reference and cross-tenant access tests. |
| Intelligence reuse | Existing transport spend, carrier performance and risk calculations accept operational evidence. | Deterministic integration tests, no duplicate formulas. |
| Operator UX | A non-dashboard journey executes the end-to-end lifecycle. | Manual/e2e acceptance journey. |
| Sample data | Non-sensitive logistics demonstration records. | Seed/fixture tests, no real customer data. |

### MVP 1 explicit exclusions

MVP 1 does not include full tendering, automated carrier selection, rate-card calculation, invoice matching, freight-payment posting, claims settlement, provider portal, live telematics, global optimization or Control Tower UI.

## MVP 2 — 3PL / 4PL Control

**Outcome:** A controlled operator can convert a transport requirement into a provider-selection workflow with rate/contract context, tender, response, award, execution monitoring and freight-audit workflow.

| Capability | Required MVP 1 foundation | Additional gate |
|---|---|---|
| Rate/contract context | Provider, shipment and charge identities. | Contract authority/data-quality decision. |
| Tender and response | Transport requirement, provider and tenant/external actor boundaries. | Provider-user/portal security model. |
| Award/allocation | Auditable provider assignment and approvals. | SoD/approval policy and capacity evidence. |
| Freight audit | Expected/actual charges and invoice references. | ERP accounting boundary and variance policy. |
| Multi-provider coordination | Event, exception and provider performance model. | Operational SLAs and escalation contracts. |

## MVP 3 — Orchestration and selective optimization

**Outcome:** Subject to evidence, Logix supports multi-provider allocation, capacity context, SLA-driven recommendations, cross-domain exception impact and advanced operational coordination.

This stage remains intentionally unscheduled. It depends on verified operational adoption, trusted event data, provider integration coverage, legal/commercial agreements and governance for recommendation-to-action workflows.

## Architecture and implementation gates

| Gate | Required deliverable | Current branch position |
|---|---|---|
| Gate 0 — Evidence | Current repository state, branches, SHAs, CI, tests and duplication evidence. | Complete. |
| Gate 1 — Architecture | Portfolio map, product boundary, ownership matrix, canonical model, domains, intelligence design, integration contracts and migration plan. | Complete in this branch's documentation. |
| Gate 2 — Foundation | MVP 1 entities, tenant boundaries, lifecycle, provider/event/exception model and tests. | In progress. |
| Gate 3 — Intelligence integration | Existing spend/performance/risk calculations reconciled against operation evidence. | In progress. |
| Gate 4 — Operator workflow | Shipment-to-POD operator journey. | In progress. |
| Gate 5 — Validation | Tests, security checks, integrity checks, type/lint/build and KAAF checks. | Pending final validation. |

## Operator acceptance journey

```mermaid
flowchart LR
  A[Create shipment] --> B[Assign provider]
  B --> C[Record milestone]
  C --> D[Detect / open exception]
  D --> E[Assign and resolve]
  E --> F[Confirm delivery]
  F --> G[Attach POD]
  G --> H[View provider / spend insight]
```

The operator journey is the MVP 1 center of gravity. Dashboard insight is useful only when it leads to an authorized, auditable action.

## Public product presentation note

After technical architecture freeze, the public interface should present the following portfolio taxonomy:

| Layer | Presentation |
|---|---|
| Entry point | Digital Operations Diagnostic |
| Core applications | KYNOX WMS — Warehouse Operations; KYNOX Logix — Logistics Operations & Orchestration; KYNOX R4C — Construction / Project Operations |
| Embedded capability | KYNOX Intelligence |
| Future capability | Operations Control Tower |

No website code or public-information architecture is changed by this branch.

## Evidence references

- [Portfolio architecture](../architecture/KYNOX_PORTFOLIO_ARCHITECTURE_V2.md)
- [3PL/4PL domain model](../architecture/LOGIX_3PL_4PL_DOMAIN_MODEL.md)
- [Control Tower readiness](../architecture/CONTROL_TOWER_READINESS.md)
- [Public interface current architecture](../../../Islamce-kynox-interface/docs/ARCHITECTURE.md)
