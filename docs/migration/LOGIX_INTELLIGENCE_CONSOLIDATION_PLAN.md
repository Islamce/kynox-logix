# Logix Intelligence Consolidation Plan

**Status:** Controlled migration plan; no repository is deleted, archived or altered by this document.  
**Decision:** Establish Logix as the operational platform while retaining intelligence as shared, evidence-driven capability. Consolidate implementation only where compatibility, ownership and rollback evidence are complete.

## Why consolidation is needed

`Islamce/kynox-logix` and `Islamce/kynox-inventory-analytics` have materially overlapping monorepo structures: API, web, shared types, data quality, analytics engine, AI engine and logistics engine. The overlap creates risk of duplicate KPI formulas, divergent tenant behavior and inconsistent canonical types. It does **not** by itself authorize destructive migration. The source-of-truth hierarchy remains runtime, Git, tests/CI, KAAF and then operational memory.

## Capability migration matrix

| Capability | Current source implementation | Target disposition | Dependencies | Test evidence required | Migration approach | Deprecation / rollback | Data impact |
|---|---|---|---|---|---|---|---|
| File parsing and source detection | Both Logix and Inventory Analytics API/data-quality packages. | Shared package candidate; no immediate move. | Parser contracts, upload validation, source detection. | Golden-file parsing, mapping and quality regression tests. | Compare package digests/contracts; extract only if behavior is identical or versioned. | Keep both paths until release compatibility and rollback period pass. | No customer-data move required. |
| Canonical inventory transaction normalization | Both repositories. | Shared canonical module candidate. | Canonical types, migrations, analytics engines. | Row-level normalization snapshots, tenant isolation and data migration rehearsal. | Introduce versioned contract; migrate consumers one at a time. | Previous normalization version remains readable; preserve source rows. | Potential historic normalization-version coexistence. |
| Data quality and cleansing | Both repositories. | Shared deterministic library candidate. | Parser/mapping contracts and rule configuration. | Quality-score and cleansing-action regression suite. | Extract with exact API compatibility; pin versions. | Roll back consumer to previous library release. | No direct data rewrite. |
| Inventory analytics | Both repositories / existing Analytics app. | Keep outside Logix operations core, consumable as embedded/shared intelligence. | Canonical transaction model and KPI registry. | Formula test suite and report comparison. | Expose/version engine contract; do not copy into Logix route/UI code. | Continue current application as reference until adoption evidence. | Derived metrics only; no operational-record transfer. |
| Logistics analytics | Both repositories / `packages/logistics-engine`. | Reuse in Logix directly now. | Shipment/provider/charge evidence adapters. | Existing unit tests plus operational-evidence integration tests. | Extend only input adapters and add KPI registry wrappers. | Pure functions remain versioned and independently testable. | No raw data migration; operational tables become input source. |
| AI evidence interpretation | Both repositories / `packages/ai-engine`. | Shared governance-pattern candidate. | Evidence package schema, provider configuration, audit policy. | Governance failure tests, no-provider behavior, tenant data isolation. | Do not migrate prompts until stable operation evidence exists. | Disable AI integration without affecting deterministic operations. | AI logs remain tenant-scoped; no prompt-data bulk transfer. |
| Tenant/RBAC | Both repositories contain implementation. | Per-product enforcement with shared policy alignment. | Auth, tenant membership, role matrix. | Cross-tenant, IDOR, inactive membership and permission tests. | Align claims/role vocabulary through a contract; do not centralize abruptly. | Product continues local authorization if shared alignment is delayed. | Identity migration is a Founder/security decision. |
| Audit | Both repositories. | Per-system append-only audit plus common envelope conventions. | Actor identity, tenant context, event IDs. | Audit completeness and tamper-resistance tests. | Adopt common field vocabulary; no shared mutable audit database. | Local audit remains authoritative. | None. |
| Analytics UI | Both repositories. | Keep Inventory Analytics UI separate from Logix operator UI. | API contracts and product navigation. | Acceptance tests for both user journeys. | Link/integrate only after product information architecture is approved. | Existing UI remains intact. | No data move. |

## Controlled migration gates

| Gate | Entry criteria | Exit evidence | Stop / rollback trigger |
|---|---|---|---|
| 0 — Inventory | Git/branch/SHA and package/API surface comparison captured. | Signed evidence matrix and owner decision. | Unknown runtime ownership or incompatible licenses/dependencies. |
| 1 — Contract | Candidate shared APIs/types versioned and documented. | Consumer contract tests pass in both repositories. | Breaking behavior or ambiguous system-of-record ownership. |
| 2 — Compatibility | Existing and candidate implementations run against the same non-sensitive fixtures. | Identical or explicitly accepted results with limitations recorded. | KPI/normalization divergence, tenant leakage or audit gaps. |
| 3 — Pilot | One non-destructive consumer uses versioned capability. | Production-like staging validation and rollback demonstrated. | Latency, security or data-quality regression. |
| 4 — Adoption | Remaining approved consumers migrate sequentially. | Per-consumer test/CI evidence and deprecation notice. | Any incomplete consumer migration. |
| 5 — Retirement | No runtime/package dependents; retention obligations met. | Founder-approved destructive-change plan. | Missing downstream evidence or unmet retention obligation. |

## Data migration principles

1. No customer data is copied across repositories merely to reconcile code structure.
2. Derived metrics can be recomputed from governed source facts; raw source and operational provenance remain with their system of record.
3. Canonical IDs are not retroactively replaced without an explicit translation table, tenant mapping and rollback plan.
4. Historical KPI calculations retain their formula/version provenance.
5. A migration must be reversible at the application-routing level before any destructive data action is considered.

## Current branch actions

This branch implements only the lowest-risk consolidation decision: **reuse existing deterministic Logix logistics intelligence functions as the intelligence layer over newly persisted Logix operational evidence**. It does not copy Inventory Analytics source, delete duplicate packages, archive its repository, or migrate customer data.

## Deferred decisions requiring Founder approval

The following are business/security decisions rather than implementation assumptions: the long-term canonical repository/package ownership for shared intelligence; identity-provider consolidation; cross-product tenant model; data-retention rules; historical data transfer; deprecation date for Inventory Analytics; and any repository retirement or archive operation.

## Evidence references

- [Logix module inventory](../../.ai/summary.md)
- [Inventory Analytics source structure](../../../kynox-inventory-analytics/packages/)
- [Logix tenant tests](../../apps/api/src/tenantIsolation.test.ts)
- [Logix logistics-engine tests](../../packages/logistics-engine/src/)
- [Capability ownership matrix](../architecture/CAPABILITY_OWNERSHIP_MATRIX.md)
