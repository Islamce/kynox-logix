# KYNOX Logix — Logistics Operations & Orchestration

KYNOX Logix is an enterprise-grade **Logistics Operations, 3PL Management and future 4PL Orchestration Platform with embedded KYNOX intelligence**. It operates tenant-scoped providers, transport requirements, shipments, lifecycle milestones, logistics exceptions, POD metadata and freight operational context while retaining governed SAP/ERP/WMS/Excel/CSV ingestion, deterministic inventory/logistics intelligence and evidence-led AI interpretation.

Deployed standalone at `https://logix.kynox.io`. It is isolated from
`analytics.kynox.io`, `www.kynox.io`, and the production WMS.

## Architecture at a glance

```
kynox-logix/
├── apps/
│   ├── api/        Express + TypeScript REST API (serves the built SPA in production)
│   └── web/        React + Vite + Tailwind + ECharts frontend
├── packages/
│   ├── shared-types/       Canonical data model, RBAC matrix, DTOs
│   ├── analytics-engine/   Pure deterministic analytics (ABC, XYZ, aging, forecasting…)
│   ├── data-quality/       Parsers, validation rules, scoring, cleansing
│   ├── logistics-engine/   Pure deterministic transport spend, provider-performance and risk functions
│   └── ai-engine/          Provider abstraction, evidence interpretation and governance
├── docs/           Architecture, deployment, KPI dictionary, guides
├── database/       SQLite file location for local dev
├── uploads/        Uploaded source files (never modified)
└── exports/        Generated reports
```

Key design principles (enforced in code, not just documented):

- **Backend complexity, frontend simplicity** — all formulas live in
  `packages/analytics-engine` as pure, unit-tested functions; the UI shows
  plain-language explanations, definitions and drill-downs.
- **No black-box analytics** — every classification returns *why* (reason
  strings, formulas, thresholds, confidence); KPI tiles carry definition +
  formula tooltips.
- **Operator-centered and human-in-the-loop** — shipment lifecycle, provider assignment, milestones, exceptions and POD evidence are authenticated and audited; intelligence and AI remain advisory.
- **Bounded ownership** — Logix owns logistics operations, WMS owns warehouse execution, R4C owns project/commercial truth and ERP remains accounting authority.
- **Source-data protection** — original files are kept verbatim; datasets are
  versioned; every transformation is logged.
- **Governed AI** — the AI never computes metrics or queries the database. It
  receives a structured evidence package from deterministic services, and its
  output must pass governance checks (evidence present, confidence stated,
  values traceable) or insights are withheld. Without an API key the AI
  features return an honest 503 — never fake analysis.

## Quick start (local development)

```bash
npm install
npm run build:packages          # compile shared packages once
cp .env.example .env            # defaults work for dev (SQLite); set ADMIN_INITIAL_PASSWORD
npm run migrate                 # create the schema
npm run seed                    # development/UAT admin, configuration and fictional Logix operations fixture
npm run dev:api                 # API on :4000
npm run dev:web                 # UI on :5173 (proxies /api to :4000)
```

If `ADMIN_INITIAL_PASSWORD` is unset, the seed prints a generated password once.

## Production build & start

```bash
npm run build                   # packages + api + web
npm run migrate
# Provision the initial administrator through the approved production-access procedure; never seed production data.
npm start                       # serves API and the SPA on $PORT
```

Health endpoints: `/api/health`, `/api/version`, `/api/readiness`.

## Tests

```bash
npm test        # full deterministic, API integration and tenant/security test suite
```

## Documentation

| Document | Purpose |
|---|---|
| `docs/architecture/KYNOX_PORTFOLIO_ARCHITECTURE_V2.md` | Reconciled KYNOX portfolio, evidence gate and implementation scope |
| `docs/architecture/LOGIX_3PL_4PL_DOMAIN_MODEL.md` | Logix operations, 3PL/4PL bounded-domain model and lifecycle |
| `docs/architecture/CANONICAL_OPERATIONS_MODEL.md` | Tenant-scoped canonical operations entities, events and audit rules |
| `docs/ARCHITECTURE.md` | Existing modules, data model, API map and AI agent design |
| `docs/DEPLOYMENT_HOSTINGER.md` | Subdomain setup, Node app config, DB, SSL, backup, rollback |
| `docs/KPI_DICTIONARY.md` | Every KPI/classification: definition, formula, configuration |
| `docs/AI_GOVERNANCE.md` | AI safeguards, agent responsibilities, logging |
| `docs/USER_GUIDE.md` | End-user walkthrough of the 7-step import and all modules |
| `.env.example` | Full environment variable template |

## Security summary

JWT auth (bcrypt-hashed passwords, account lockout and login rate limiting), fail-closed tenant membership and per-route RBAC, parameterised queries via Knex, helmet security headers, API rate limiting, sanitised errors and append-only audit records. Logix operations enforce tenant-scoped object lookups, deterministic lifecycle transitions, event provenance/idempotency and validated POD metadata references; no secrets or raw attachment payloads enter the audit trail.
