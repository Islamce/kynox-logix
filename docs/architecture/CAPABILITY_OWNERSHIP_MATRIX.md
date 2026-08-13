# KYNOX Capability Ownership Matrix

**Status:** Architecture reconciliation decision record.  
**Legend:** `Own` means system of record; `Use` means governed consumption; `Support` means a bounded enabling capability; `—` means no ownership; `Future` means designed but not implemented.

The matrix prevents product overlap. A capability may be shared through contracts or a deterministic library, but a business transaction has one accountable operational owner.

| Capability | WMS | Logix | Inventory Analytics | R4C | Shared capability | Recommended owner | Duplication disposition |
|---|---|---|---|---|---|---|---|
| Warehouse execution | **Own** | Use evidence only | Use evidence only | Use context only | Audit/event conventions | **WMS** | Keep in WMS; prohibit Logix writes. |
| Receiving, putaway, bins, pick/issue, internal transfer | **Own** | — | — | — | — | **WMS** | Keep; expose governed read/event contract only. |
| Warehouse reservations/allocation/reallocation | **Own** | Reference only | Use analytical input | Reference only | Identifier/provenance conventions | **WMS** | Keep; never replicate as Logix state. |
| Shipment management | — | **Own** | Preview/import vocabulary only | Request/status consumer | Identity/event conventions | **Logix** | Reimplement as tenant-scoped operational model in Logix. |
| Transport requirement | — | **Own** | — | Originates project requirement context | Canonical ID/provenance conventions | **Logix** | Build in Logix; R4C uses a contract. |
| Carrier / 3PL / provider management | — | **Own** | Analytics dimensions only | — | KPI definitions | **Logix** | Build operational provider model; retain analytics dimension adapters. |
| Provider performance | Inputs only | Use/operate | Existing pure metrics | Use impact | Deterministic formulas | **Shared intelligence**, consumed by Logix | Reuse/wrap existing logistics-engine, do not copy. |
| Transport spend | — | Operational charge context | Existing pure metrics | Use project exposure | Deterministic formulas | **Shared intelligence**, consumed by Logix | Reuse/wrap existing logistics-engine, do not copy. |
| Shipment/material risk | Availability evidence | Own exception/business impact linkage | Existing pure risk calculation | Project-impact context | Deterministic risk function | **Shared intelligence** with Logix workflow ownership | Wrap existing risk engine; do not duplicate scoring. |
| Tender, award and carrier allocation | — | Future own | — | May originate demand | Workflow/event conventions | **Logix** | Design now; defer full execution to MVP 2. |
| Rate/contract context | — | Future own operational context | — | — | KPI and currency conventions | **Logix** | Design now; do not build accounting. |
| Freight audit / dispute | — | Future own operational workflow | Analytics input only | — | Cost-variance formula | **Logix** with ERP authority for accounting | Design now; defer full audit workflow to MVP 2. |
| Inventory intelligence | Source data | Consume evidence | Existing pure engine and application | Consume impact | Deterministic metrics | **Shared intelligence** | Keep external until a governed extraction/reuse plan succeeds. |
| Materials intelligence | WMS evidence | Use shipment linkage | Existing / emerging analytics inputs | Own project-material context | Canonical material/risk logic | **Shared intelligence** | Share contracts/functions; do not create a new product. |
| Planning intelligence | Supply/stock evidence | Consume demand/service effects | Existing forecast/planning engine | Project demand context | Deterministic metrics | **Shared intelligence** | Keep outside Logix operational core. |
| Data quality / parsing / mapping | Source feeds | Import adapter use | Existing package/pipeline | Its own adapter policies | Reusable package candidates | **Shared intelligence foundation** | Extract/refactor only after contract and versioning decision; no mass copy. |
| AI interpretation | — | Consume evidence package | Existing governed AI module | Consume project evidence | Decision-intelligence guardrails | **Shared intelligence** | Reuse policy/module patterns; no standalone AI product. |
| Canonical identifiers | Existing local IDs | **Own operational IDs** | Existing dataset/canonical IDs | Existing local IDs | ID envelope/translation policy | **Shared operations foundation** | Share conventions, not a forced centralized database. |
| Tenant/RBAC | Local implementation | Existing tenant/RBAC foundation | Equivalent source implementation | Local implementation | Cross-product policy | Per product, with shared policy | Keep product enforcement; align roles/claims later by contract. |
| Audit events | Warehouse audit | Existing audit foundation; extend operations events | Existing audit foundation | Existing audit module | Audit-envelope convention | Per system of record | Keep append-only facts locally; share correlation/provenance contract. |
| Public product interface | — | Capability metadata only | — | Capability metadata only | Portfolio taxonomy | Public interface repository | Future website content change only. |
| Operations Control Tower | Source evidence | Supply logistics facts | Supply intelligence | Supply project facts | Cross-domain views/actions | Future capability | Design data/events now; do not build a new product/UI. |

## Implementation classification — Logix compared with Inventory Analytics

The two repositories contain substantially overlapping inventory-diagnostic package and API structure. The comparison is evidence-based: both repositories expose `apps/api`, `apps/web`, `packages/shared-types`, `packages/data-quality`, `packages/analytics-engine`, `packages/ai-engine` and `packages/logistics-engine`. This foundation must therefore avoid a second copied implementation of those capabilities.

| Capability | Evidence | Classification | Decision and rationale |
|---|---|---|---|
| Ingestion and file parsing | Both repositories contain `apps/api` upload/dataset flow and `packages/data-quality` parsers. | **B — Extract/refactor** | Keep the current Logix pipeline operating. Define a versioned adapter boundary; do not copy more code until a single shared package has a governed release path. |
| SAP report detection and mapping | `services/detection.ts`, `services/mapping.ts` and shared canonical fields exist in Logix and Inventory Analytics. | **B — Extract/refactor** | Reuse the existing implementation in-place for this branch; consolidate only through a tested shared package later. |
| Data-quality engine | `packages/data-quality` is present in both repositories. | **B — Extract/refactor** | It is a cross-product candidate. Avoid changing behavior during operational foundation work. |
| Inventory canonical model | `packages/shared-types/src/canonical.ts` exists in both. | **B — Extract/refactor** | Preserve source-independent material/inventory vocabulary. Add operations types additively, without redefining inventory facts. |
| Inventory analytics | `packages/analytics-engine` supplies ABC/XYZ, aging, excess/shortage, planning and forecasting. | **D — Keep outside Logix operational core** | Continue treating it as embedded/shared intelligence, not a shipment operations module. |
| Logistics analytics | `packages/logistics-engine` supplies spend, carrier performance and risk calculations. | **A — Reuse directly** | Retain the pure functions in Logix and feed them operational evidence; no duplicate formulas. |
| AI layer | `packages/ai-engine` implements governed evidence packages and provider abstraction. | **B — Extract/refactor** | Reuse the governance approach and evaluate shared extraction after operations evidence is stable. |
| Authentication, tenancy and RBAC | Logix contains `tenant_foundation` migration, `middleware/auth.ts`, tenant tests and shared role permissions. | **A — Reuse directly** | Extend the existing fail-closed enforcement and test it against every new operational object. |
| Audit | Logix has `services/audit.ts` and append-only audit records. | **A — Reuse directly** | Use for every operator action and operational event. |
| Inventory-diagnostic UI | Analytics-led React pages and navigation exist in both. | **D — Keep outside Logix operations core** | Add an operator workflow separately; do not mutate data-workspace workflows into a pseudo-TMS. |
| Duplicate portfolio implementation | Nearly equivalent monorepo structures. | **E — Retire duplicate only after migration approval** | No deletion or archive action in this branch. The consolidation plan defines conditions, tests and rollback. |

## Ownership safeguards

1. **One transaction, one owner.** Logix links to WMS and R4C facts by canonical/external reference; it never changes their aggregate state.
2. **One formula, one definition.** KPI calculations are isolated in deterministic engines and registered in the canonical KPI registry.
3. **One tenant context per request.** Every operational table and object-level query must include the authenticated `tenant_id`.
4. **One evidence trail per fact.** Imported/tracked facts carry source, external ID, correlation, causation where known, payload digest and idempotency semantics.
5. **One future extraction path.** Cross-product reuse happens through versioned contracts/packages, not by mass copying source directories.

## Evidence references

- [Logix generated modules and source boundaries](../../.ai/summary.md)
- [Existing logistics intelligence package](../../packages/logistics-engine/src/index.ts)
- [Existing data-quality package](../../packages/data-quality/src/index.ts)
- [Existing tenant enforcement](../../apps/api/src/middleware/auth.ts)
- [Existing role matrix](../../packages/shared-types/src/index.ts)
- [WMS execution routes](../../../WMS/server/routes/)
- [R4C bounded modules](../../../R4C/apps/api/src/)
- [Consolidation plan](../migration/LOGIX_INTELLIGENCE_CONSOLIDATION_PLAN.md)
