# KYNOX LOGIX — Deployment Readiness and Production Qualification

**Status:** `NO-GO` pending completion of external hosting, production-parity database runtime, storage, backup/restore, UAT, and signed Flutter release gates.

**Scope:** This document supersedes stale Analytics/Inventory deployment instructions for the LOGIX product. It is an evidence record, not an approval to attach the production domain or publish a mobile release.

## Canonical Product Record

| Item | Canonical value |
|---|---|
| Product | KYNOX LOGIX — Logistics & Supply Chain Intelligence Platform |
| Repository | `Islamce/kynox-logix` |
| Production domain | `https://logix.kynox.io` |
| Deployment model | Hostinger Managed Node.js Web App + isolated MySQL, subject to current Hostinger capability verification |
| API/runtime | Existing Node.js/Express application |
| Mobile client | Flutter Android client, source/analyze/test/debug-APK qualified; signed release and critical journeys pending |
| Database | Isolated LOGIX database, logically named `kynox_logix` in the environment template |

## Repository Evidence

The audit was performed against the local clone on 14 August 2026. The checked-out base was `main` at `cd847997358a869fb0b51a43586d5b29b4b7463c`; the working qualification branch is `manus/logix-readiness-recovery` and includes the open PR #2 adapter commit as local commit `4c6aa48`; the current release-candidate commit is `dcf568c465a2f2aacf02ecfd4ddb68c1df36abfd`. The repository was clean before qualification changes. The only open pull request observed was PR #2, `feat: add logistics compatibility adapter`, from `feat/logistics-compatibility-adapter` into `main`.

The repository is a Node.js monorepo with an Express API, React/Vite web client, deterministic analytics/data-quality/logistics packages, and an AI governance layer. The root scripts provide package build, API build, web build, migration, seed, test, and typecheck commands. The API exposes `/api/health`, `/api/readiness`, and `/api/version` as the minimum deployment probes described by the release brief.

## PR #2 Classification

**Classification: FIX THEN MERGE.** The adapter is a narrow compatibility boundary that delegates to existing logistics-engine functions, exposes explicit contract and formula versions (`1.0.0`), and adds focused tests. It does not introduce tenant, session, storage, UI, or commercial workflow ownership. The classification remains conditional because full repository qualification on the candidate branch must pass, and merge approval is an owner-controlled repository action.

## Changes Applied on Qualification Branch

| Area | Change | Evidence |
|---|---|---|
| Logistics engine | Added the reviewed compatibility adapter and focused tests from PR #2 | Local commit `dc83a1a`; `git diff main...origin/feat/logistics-compatibility-adapter` |
| Security/configuration | Corrected the production CORS validation message from the former Analytics domain to `https://logix.kynox.io` | `apps/api/src/config.ts` |
| Deployment configuration | Updated `.env.example` to canonical LOGIX identity and isolated logical database name `kynox_logix` | `.env.example` |
| Documentation | Added this authoritative readiness document to supersede contradictory Analytics deployment authorities | This file |

No production secrets, signing keys, domain cutover, database migration, or external deployment was performed.

## Qualification Commands and Current Results

| Validation | Result | Evidence |
|---|---|---|
| Repository clone | PASS | `gh repo clone Islamce/kynox-logix` completed |
| Base branch and SHA capture | PASS | `main`, `cd847997358a869fb0b51a43586d5b29b4b7463c` |
| Open PR inventory | PASS | One open PR, #2 |
| Working branch | PASS | `manus/logix-readiness` |
| Dependency installation | PASS | `npm ci --ignore-scripts` completed |
| Typecheck | PASS | Ordered `npm run typecheck` passed across all workspaces |
| Full build | PASS | Ordered `npm run build` passed; web bundle built successfully |
| Repository hygiene | PASS | `git diff --check` passed; secret-pattern scan found no matching key material |
| Unit/integration tests | PASS | Full repository suite passed: 9 files and 98 tests, including API integration, logistics, inventory, security-related, and compatibility coverage |
| SQLite recovery | PASS | `npm ci --ignore-scripts` followed by `npm rebuild better-sqlite3 --build-from-source` produced the Node 22 native binding |
| Production startup guards | PASS | Added `config.production.test.ts`; MySQL and PostgreSQL positive cases plus SQLite/unset/incomplete negative cases passed |
| Flutter dependency resolution | PASS | Flutter 3.47.0 / Dart 3.13.0; `flutter pub get` passed |
| Flutter analyze | PASS | `flutter analyze` reported no issues |
| Flutter tests | PASS | `flutter test`: all tests passed |
| Android debug APK | PASS | `build/app/outputs/flutter-apk/app-debug.apk` produced |
| Android release APK | NOT QUALIFIED | Gradle daemon disappeared under current memory pressure; no signed release artifact is claimed |
| Flutter SDK | PASS | Flutter 3.47.0 stable with Dart 3.13.0 installed from the official stable channel |
| Hostinger capability | NOT VERIFIED | No Hostinger panel/session evidence or deployment credentials were available |
| Production database | NOT VERIFIED | No isolated Hostinger MySQL instance or connection evidence was available |
| Backup restore | NOT VERIFIED | No backup/restore execution against a validation database was available |
| Production runtime | NOT VERIFIED | No temporary-host deployment evidence was available |

The recovered qualification lane is now green for local code evidence. Under Node 22.13.0 and npm 10.9.2, the optional `better-sqlite3` module was rebuilt from source after installing the local compiler toolchain. The ordered package build, typecheck, full build, and full test suite passed; the final test result was 9 files and 98 tests passed. Added production startup-guard tests verify MySQL and PostgreSQL acceptance, SQLite rejection, unset `DB_CLIENT` rejection, and missing credential rejection. Flutter 3.47.0 / Dart 3.13.0 passed `pub get`, `analyze`, and unit tests. Android tooling was installed, and a debug APK was produced. The release APK attempt was not qualified because the Gradle daemon disappeared under current sandbox memory pressure; no signed release artifact is claimed. These local results do not replace live Hostinger, MySQL, persistence, backup/restore, or UAT evidence.

## Mandatory Release Gates

| Gate | Required evidence | Current status |
|---|---|---|
| Exact release SHA | Candidate SHA recorded and reproducible | PASS: `dcf568c465a2f2aacf02ecfd4ddb68c1df36abfd` |
| Build and typecheck | Ordered package build, API/web build, and typecheck pass | PASS locally |
| Tests | Actual test count on exact SHA, including API and logistics suites | PASS locally: 98 tests |
| Security | Verified tests for auth, RBAC, tenant isolation, uploads, rate limits, headers, CORS, errors, dependencies, and secrets | OPEN |
| Isolated database | Hostinger-supported MySQL database and least-privilege credentials | OPEN |
| Controlled migrations | Backup, target verification, migration status, migration, and seed evidence | OPEN |
| Persistent storage | Upload/import/redeploy/recovery test proves files and lineage survive | OPEN |
| Temporary deployment | Temporary Hostinger URL with health, readiness, version, runtime, and logs evidence | OPEN |
| UAT | Web critical journeys pass | OPEN |
| Flutter client | Flutter analyze, tests, debug/release build, and critical journeys pass | PARTIAL: analyze/tests/debug APK pass; release/critical journeys open |
| Backup/restore | SQL backup restored to a separate validation database and checked | OPEN |
| Production cutover | Founder-approved domain attach and SSL verification | OWNER ACTION REQUIRED |

## Deployment Procedure After Local Gates Pass

Deploy first to a temporary Hostinger environment. Record the exact SHA, timestamp, Node version, database version, build output, start result, runtime logs, and the three API probes. Create and verify the isolated LOGIX database before running controlled migrations. Confirm that uploads and exports use persistent storage; if managed Node storage is ephemeral, production must stop until storage is redesigned. Validate authentication, RBAC, import, analytics, logistics intelligence, audit lineage, and backup restoration on the temporary environment.

Only after every hard gate passes and the Founder explicitly approves the cutover may `logix.kynox.io` be attached, SSL enabled, and production URLs set to `https://logix.kynox.io`. The Flutter production API endpoint must be supplied through a controlled build configuration rather than an immutable source constant.

## Decision

**NO-GO.** Local code qualification has materially recovered: typecheck, full build, 98 backend tests, production startup guards, Flutter analyze/tests, and a debug APK pass. The release remains blocked by missing live MySQL production-parity runtime evidence, Hostinger capability/deployment evidence, persistent storage validation, backup/restore, end-to-end UAT, Flutter critical journeys, and a release APK/signing outcome. No production deployment or domain cutover should occur until those gates are independently recorded.

## Owner-Only Actions

The following actions require access or approval not present in this session: Hostinger panel capability verification, private-repository deployment configuration, creation of the isolated production database, temporary deployment, DNS/domain attachment, SSL cutover, production secret entry, backup restoration in Hostinger, and approval to merge PR #2 or publish an Android release.

## Stale Documentation Follow-Up

A repository-wide search found stale Analytics references in several older deployment and staging documents, including `docs/HOSTINGER_MANAGED_DEPLOYMENT.md`, `docs/HOSTINGER_HPanel_CHECKLIST.md`, `docs/STAGING_DEPLOYMENT.md`, `docs/STAGING_MONITORING.md`, and `docs/STAGING_UAT_PLAN.md`. Those documents must be migrated to LOGIX or clearly marked historical/superseded before they can be used as operational runbooks. This readiness document is the current authority until that reconciliation is complete.
