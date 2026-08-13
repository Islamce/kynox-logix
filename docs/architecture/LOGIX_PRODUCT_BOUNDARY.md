# KYNOX Logix Product Boundary

**Status:** Target boundary for Logix MVP 1.  
**Architecture decision:** **KYNOX Logix owns logistics execution and multi-provider orchestration; it does not own warehouse execution, project-commercial truth or accounting.**

> KYNOX Logix is the system of operational record for the lifecycle of a transport requirement and its shipment execution, including provider coordination, milestones, exceptions, proof of delivery and the operational context required for future 3PL/4PL orchestration.

## Product definition and progression

Logix evolves deliberately from **Observe** to **Operate** to **Orchestrate**. The current implementation scope is the dependable core of **Operate** with foundations that prevent an architectural rewrite when controlled tendering and multi-provider allocation are later authorized. Optimization, automation and 5PL-like behavior are neither implied nor implemented.

| Stage | Logix responsibility | MVP status | Boundary |
|---|---|---|---|
| Observe | Transport spend, carrier performance, shipment/material risk, SLA and data-quality insights. | Existing deterministic package; reconciled in this branch. | Intelligence explains operational evidence; it does not mutate it. |
| Operate | Shipment/provider records, state transitions, milestones, exceptions, delivery and POD. | MVP 1 foundation. | Logix is the operational record for these logistics facts. |
| Orchestrate | Transport requirements, tendering, award, allocation, rate/contract context and freight audit. | Designed only; staged MVP 2. | Future work must preserve the canonical entities introduced now. |
| Optimize | Dynamic allocation, cross-network optimization and increasing decision automation. | Explicitly deferred. | Requires measurable operational evidence and governance. |

## Bounded ownership

| Domain fact or action | System of record | Logix responsibility | Forbidden Logix behavior |
|---|---|---|---|
| Receiving, putaway, bins, picks, issues, internal transfers, counts and batch/serial traceability | WMS | Consume governed evidence where relevant to a shipment or availability/risk decision. | Creating, changing or reversing warehouse transactions. |
| Inventory position, reservations and warehouse availability | WMS / governed inventory source | Reference snapshots and reservation identifiers; attach evidence/provenance. | Reallocating stock or changing reservations directly. |
| Project, WBS, budget, commitment, project requirement and commercial exposure | R4C | Store external references on transport requirements and exceptions; return delivery status and impact. | Editing project-commercial data or becoming an R4C substitute. |
| Transport requirement, shipment, leg, booking context, provider assignment and carrier coordination | Logix | Own lifecycle, provider assignment, timeline and audit. | None within approved logistics scope. |
| Milestone, tracking context, delivery, POD and logistics exception | Logix | Own normalized operational event/exception record, chronology and resolution workflow. | Treat a source update as unproven without provenance or idempotency safeguards. |
| Rate card, operational contract reference, expected charge, invoice variance, claim/dispute status | Logix, subject to ERP accounting truth | Own operational comparison and workflow context. | Posting journals, processing payments, or replacing ERP accounting. |
| Deterministic KPI definition and calculation | Shared intelligence contract; current in-repository engines until extraction is justified | Reuse current pure functions and canonical KPI registry. | Duplicate a formula in page controllers or UI components. |
| AI explanations and recommendations | Embedded decision intelligence | Explain, prioritize and recommend over validated evidence. | Silently change deterministic results or make unapproved operational commitments. |

## Entity-level ownership

| Entity | Business owner | System of record | Tenant boundary | Lifecycle owner | Audit behavior |
|---|---|---|---|---|---|
| Transport Requirement | Logistics operations | Logix | Tenant | Logix | Creation, source linkage, status changes and conversion to shipment are auditable. |
| Shipment / Shipment Leg | Logistics operations | Logix | Tenant | Logix | Create/update/transition history and source-event provenance are immutable records. |
| Provider / Carrier / 3PL / Forwarder | Logistics operations | Logix for operational profile; contract master may originate externally | Tenant | Logix | Qualification and status changes are auditable. |
| Milestone / Tracking Event | Logistics operations | Logix normalized event store | Tenant | Logix | Payload digest, external ID, source, chronology, idempotency and actor are auditable. |
| Logistics Exception | Logistics operations | Logix | Tenant | Logix | Severity, owner, escalation, resolution and impact linkage are auditable. |
| POD metadata / attachment reference | Logistics operations | Logix metadata; validated object store when configured | Tenant | Logix | Access, checksum, uploader and association are auditable. |
| Warehouse Movement / Reservation | Warehouse operations | WMS | Originating tenant / WMS contract | WMS | Logix stores a read-only reference only. |
| Project Requirement / WBS | Project operations | R4C | Originating tenant / R4C contract | R4C | Logix stores a read-only external reference only. |
| Freight invoice / settlement | Finance / ERP | ERP for accounting; Logix for operational review | Tenant | ERP and Logix respectively | Logix records variance/dispute workflow but does not post accounting entries. |

## Explicit non-goals

The following are **not** Logix scope in this branch: fleet management, driver payroll, vehicle maintenance, vehicle telematics infrastructure, global routing optimization, marketplace functions, supplier procurement, customs processing, payments, full accounts payable, standalone control-tower UI, autonomous decision execution and full IBP.

## Product-tier compatibility

The proposed commercial capability tiers are architecturally compatible with this boundary. **Logix Insight** consumes governed shipment, charge and provider evidence through deterministic metrics. **Logix Operate** owns the shipment lifecycle and exception workflow. **Logix Orchestrate** can add tender, allocation, rate context and freight-audit workflows against the same transport requirement, shipment, provider and event identifiers. Pricing is outside this branch.

| Tier | Foundation entities required | Current disposition |
|---|---|---|
| Logix Insight | Provider, shipment, milestone, charge, requirement/availability evidence. | Existing metrics retained and reconciled. |
| Logix Operate | Transport requirement, shipment, provider assignment, milestone/event, exception, delivery and POD. | MVP 1 foundation. |
| Logix Orchestrate | Rate/contract reference, tender, response, award, allocation, expected/actual charge and dispute. | Domain designed; no full workflow implementation in MVP 1. |

## Evidence basis

The Logix repository currently contains a preview-only logistics import path and pure logistics analytics, while WMS routes/services separately implement warehouse workflows and R4C maintains independent project/materials/commercial modules. This boundary is therefore **derived from current implementation evidence**, not a speculative product split.

- [Logix logistics preview gate](../../apps/api/src/routes/datasets.ts)
- [Logix read-only warehouse and R4C reference contracts](../../packages/shared-types/src/logistics.ts)
- [WMS receiving, allocation, picking and reallocation routes](../../../WMS/server/routes/)
- [R4C projects, materials and commercial modules](../../../R4C/apps/api/src/)
- [KAAF product-boundary operating rules](../../AGENTS.md)
