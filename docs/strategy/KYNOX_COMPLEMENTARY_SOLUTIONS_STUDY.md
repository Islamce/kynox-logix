# KYNOX Complementary Solutions Study

**Status:** Strategy study only; it does not authorize feature implementation.  
**Scoring scale:** Strategic fit, customer value, revenue potential and urgency are `1` (low) to `5` (high). Dependency and complexity are `1` (low) to `5` (high). Scores are **derived** from the reconciled portfolio and must be revisited with customer evidence before investment.

## Decision framework

The study prioritizes solutions that strengthen the defined portfolio: WMS warehouse execution, Logix logistics operations/orchestration, R4C project/commercial operations and embedded intelligence. A solution is not recommended merely because it is common in a broad TMS/ERP suite. The preferred action reflects the build/buy/integrate policy: build differentiated operational workflows and intelligence; integrate infrastructure and external networks; partner for physical execution.

| # | Complementary solution | Fit | Value | Revenue | Dependency | Complexity | Urgency | Preferred action | Classification | Required evidence |
|---:|---|---:|---:|---:|---:|---:|---:|---|---|---|
| 1 | Carrier / 3PL portal | 5 | 5 | 4 | 4 | 4 | 3 | Build after core operator workflow and provider security model. | **DESIGN NOW** | Provider persona, invitation/auth model, payload/access controls. |
| 2 | Rate & contract management | 5 | 5 | 4 | 4 | 4 | 3 | Build operational context; integrate authoritative contract source where applicable. | **DESIGN NOW** | Rate data quality, contract authority, currency/FX policy. |
| 3 | Tender management | 5 | 5 | 4 | 4 | 4 | 3 | Build as Logix workflow after transport requirement/provider evidence stabilizes. | **DESIGN NOW** | Provider acceptance behavior, SoD and approval policy. |
| 4 | Freight audit | 5 | 5 | 4 | 4 | 4 | 3 | Build workflow, integrate ERP invoice/accounting authority. | **DESIGN NOW** | Invoice sample quality, variance tolerance and dispute policy. |
| 5 | Claims | 4 | 4 | 3 | 4 | 4 | 2 | Build only after delivery/POD/charge exception evidence exists. | **NEXT** | Claim ownership/legal policy and loss/damage data. |
| 6 | Dock scheduling | 3 | 3 | 2 | 4 | 4 | 2 | Integrate or partner with WMS/site systems. | **INTEGRATE** | Warehouse/site workflow owner and slot demand. |
| 7 | Yard management | 2 | 3 | 2 | 5 | 5 | 1 | Partner/integrate with WMS/yard technology. | **PARTNER** | Physical-yard complexity, device/integration requirements. |
| 8 | Cross-docking | 3 | 4 | 3 | 5 | 5 | 2 | Partner with WMS/3PL execution, expose logistics context. | **PARTNER** | WMS operational ownership and site-process evidence. |
| 9 | Order orchestration | 4 | 4 | 4 | 4 | 4 | 3 | Build only bounded delivery/transport orchestration, not an OMS. | **NEXT** | ERP/order authority and exception use cases. |
| 10 | Available-to-promise intelligence | 4 | 5 | 4 | 5 | 5 | 2 | Build as shared intelligence after trustworthy inventory/demand data. | **LATER** | Real-time stock, reservation and lead-time quality. |
| 11 | Demand intelligence | 4 | 4 | 3 | 4 | 4 | 2 | Extend shared analytics, not Logix operational core. | **NEXT** | Customer demand history and forecast adoption evidence. |
| 12 | Supply/material planning | 4 | 5 | 4 | 4 | 4 | 3 | Extend shared intelligence; R4C/WMS/ERP remain source authorities. | **NEXT** | Planning ownership, lead-time/replenishment quality. |
| 13 | Supplier intelligence | 3 | 3 | 3 | 4 | 4 | 2 | Integrate ERP/procurement sources; build differentiated risk logic later. | **INTEGRATE** | Supplier-master quality and customer use cases. |
| 14 | Supplier collaboration | 3 | 3 | 3 | 5 | 5 | 1 | Do not build before supplier onboarding/economic proof. | **LATER** | Partner adoption and procurement policy. |
| 15 | Cost-to-serve | 4 | 5 | 4 | 5 | 5 | 2 | Design analytical model; integrate finance/ERP data. | **LATER** | Cost allocation, revenue and service-level data. |
| 16 | Working-capital intelligence | 4 | 5 | 4 | 4 | 4 | 2 | Extend existing inventory intelligence. | **NEXT** | Finance-approved valuation and customer demand. |
| 17 | Network design | 3 | 4 | 3 | 5 | 5 | 1 | Partner/integrate specialist tooling. | **PARTNER** | Network data, strategic planning demand, modeling competence. |
| 18 | Transport optimization | 4 | 5 | 4 | 5 | 5 | 1 | Integrate specialist optimizer after operational data maturity. | **INTEGRATE** | Route/capacity/rate data and optimization success metrics. |
| 19 | Real-time visibility | 5 | 5 | 4 | 5 | 4 | 3 | Integrate carrier/telematics providers; normalize events in Logix. | **INTEGRATE** | Carrier coverage, event latency/quality and contracts. |
| 20 | Telematics | 3 | 4 | 2 | 5 | 5 | 1 | Integrate, never recreate network infrastructure. | **INTEGRATE** | Device/provider coverage and data rights. |
| 21 | Reverse logistics | 3 | 4 | 3 | 4 | 4 | 2 | Model as a later shipment flow after return requirements are proven. | **LATER** | Returns policy, warehouse/ERP ownership. |
| 22 | Customs/trade integration | 3 | 4 | 3 | 5 | 5 | 1 | Integrate/partner; do not build customs engine. | **PARTNER** | Jurisdiction, broker API and legal review. |
| 23 | Carbon intelligence | 4 | 4 | 3 | 4 | 4 | 2 | Integrate emissions factors, build differentiated reporting/exception context later. | **NEXT** | Methodology, activity data, reporting requirement. |
| 24 | IoT/cold-chain integration | 3 | 4 | 3 | 5 | 5 | 1 | Integrate sensor providers for defined verticals only. | **INTEGRATE** | Device reliability, cold-chain customer segment. |
| 25 | Customer logistics portal | 4 | 4 | 4 | 4 | 4 | 2 | Design after core customer-sharing security and event model mature. | **LATER** | Customer persona, visibility policy and tenancy model. |
| 26 | Multi-client 3PL management | 5 | 5 | 5 | 5 | 5 | 3 | Design tenancy/account structures now; build after MVP 1 tenant evidence. | **DESIGN NOW** | Client/account model, billing model, segregation requirements. |
| 27 | Logistics billing preparation | 4 | 4 | 4 | 4 | 4 | 2 | Build operational charge evidence; integrate accounting/billing. | **NEXT** | Finance process, charge completeness and legal invoice rules. |
| 28 | Risk/resilience intelligence | 5 | 5 | 4 | 4 | 4 | 3 | Build differentiated deterministic risk over operational evidence. | **NEXT** | Disruption taxonomy, impact data and action playbooks. |
| 29 | Operations digital twin | 3 | 4 | 3 | 5 | 5 | 1 | Do not build before validated operational data and simulation use cases. | **LATER** | Stable canonical events, simulation users and ROI. |
| 30 | Future operations control tower | 5 | 5 | 5 | 5 | 5 | 3 | Design readiness now; build only after cross-domain evidence/authority gate. | **DESIGN NOW** | Cross-product data contracts, action/approval model and user research. |

## Top recommendations

The highest-value immediate architecture work is **not** a broad functional expansion. It is the operational core already approved for MVP 1: shipments, providers, lifecycle events, exceptions, POD, tenant/RBAC controls and deterministic intelligence reuse. This makes carrier/3PL portal, rate/contract, tender, freight audit, multi-client 3PL management and future Control Tower credible **design-now** initiatives rather than disconnected feature promises.

Real-time visibility, telematics, transport optimization, customs/trade, IoT/cold chain and network design should be pursued through integrations or partners because external data networks, physical operations and regulatory interfaces are not KYNOX's differentiating software core. The platform's differentiation is the trusted canonical operational model, evidence-led exception workflows, cross-domain impact and intelligent decision support.

## Explicit current non-build list

Fleet management, driver payroll, vehicle maintenance, a general marketplace, autonomous 5PL, global route optimization, standalone procurement, full customs processing and a separate Control Tower product remain outside current implementation scope. Any change to this list needs a new evidence and business-approval gate.

## References

- [Portfolio architecture](../architecture/KYNOX_PORTFOLIO_ARCHITECTURE_V2.md)
- [Product boundary](../architecture/LOGIX_PRODUCT_BOUNDARY.md)
- [Integration build/buy policy](../architecture/INTEGRATION_ARCHITECTURE.md)
- [MVP roadmap](../roadmap/LOGIX_MVP_ROADMAP.md)
