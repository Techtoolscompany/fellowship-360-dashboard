# Delivery Board

Last updated: April 1, 2026  
Canonical status board for the Fellowship 360 app.

## State Snapshot
- Root lint is green: `pnpm lint` passed on April 1, 2026.
- Broad app tests are green: `pnpm test` passed on April 1, 2026 with `38` files and `142` tests passing.
- Launch-gate tests are green: `pnpm test:launch-gate` passed on April 1, 2026 with `16` files and `50` tests passing.
- Main app build is green: `pnpm build` passed on April 1, 2026.
- Combined delivery status is still red: `pnpm status:delivery` fails only on preflight, with `4` real launch fails remaining.
- The old implementation plan is stale in places. Several flows it called incomplete already exist or were consolidated into GRACE:
  - Appointments, calendar, inbox, calls, and pipeline now redirect into the GRACE workspace.
  - Create/edit flows exist for appointments, prayer requests, ministries, pledges, broadcasts, and calendar events.
- The real remaining work is mostly operational readiness, repo hygiene, and scope cleanup.

## Now

### DLV-001 Repo Health Commands Must Reflect The App, Not Vendor Code
- Stream: `Repo Hygiene`
- Status: `Done`
- Why it matters: root-level lint and test commands were reporting failures from `vendors/` and generated artifacts, which made the repo status noisy and untrustworthy.
- Evidence:
  - Root ESLint was traversing `vendors/fellowship360-gateway/**` and `.next` output.
  - `pnpm test:launch-gate` was picking up vendor specs instead of only launch-gate files.
- Done when:
  - Root ESLint ignores vendor/generated output.
  - Root Vitest excludes vendor tests.
  - Launch-gate tests use an explicit config.

### DLV-002 Close Production Readiness Fails From Preflight
- Stream: `Launch Blocker`
- Status: `Now`
- Why it matters: the app can build, but preflight still says the production setup is not safe to launch.
- Evidence from `pnpm launch:preflight` on April 1, 2026:
  - Missing `ELEVENLABS_API_KEY`
  - Missing distributed rate limiting config: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
  - `CRON_USERNAME` still uses placeholder value
  - `CRON_PASSWORD` still uses placeholder value
- Execution doc:
  - `docs/PREFLIGHT_CLEARANCE_CHECKLIST.md`
- Done when:
  - `pnpm launch:preflight` returns zero `FAIL` items.

### DLV-003 Expand Provider Readiness Beyond One Org
- Stream: `Launch Blocker`
- Status: `Now`
- Why it matters: launch tooling shows only `1/3` organizations currently have active provider config, so multi-tenant readiness is not real yet.
- Evidence:
  - `pnpm launch:preflight` returned `Provider coverage - 1/3 orgs have active provider config`.
- Done when:
  - Each launch-target org has active required provider config and, if SMS is part of launch scope, an assigned healthy device.

### DLV-004 Make This Board The Single Source Of Truth
- Stream: `Repo Hygiene`
- Status: `Now`
- Why it matters: current planning docs conflict; one says launch ready, another says major tracks remain open.
- Evidence:
  - `docs/GRACE_MASTER_TRACKER.md` marks launch-ready work as done.
  - `IMPLEMENTATION_PLAN.md` still lists broad remaining tracks.
- Done when:
  - Active planning updates happen here first.
  - Older planning docs are treated as reference only or explicitly marked historical when touched.

## Next

### DLV-005 Fix GRACE Audit Stream Test Warnings
- Stream: `Product Hardening`
- Status: `Next`
- Why it matters: launch-gate tests pass, but GRACE router tests still emit audit-stream write warnings because the mocked DB shape is incomplete.
- Evidence:
  - `pnpm test` logs `db.insert is not a function` from `src/lib/grace/audit-stream.ts` during GRACE router tests.
- Done when:
  - Router tests pass without audit-stream write warnings, or the audit stream is intentionally no-op mocked in test mode.

### DLV-006 Decide Whether Broadcasts Are SMS-Only At Launch
- Stream: `Product Hardening`
- Status: `Next`
- Why it matters: the product has a broad messaging surface, but runtime broadcast sending currently rejects non-SMS channels.
- Evidence:
  - `src/app/actions/communications.ts` throws `Only SMS broadcasts are supported in this demo.`
- Done when:
  - Either non-SMS channels are implemented for broadcast execution, or launch scope explicitly documents SMS-only broadcasts.

### DLV-007 Expand Browser Coverage Beyond Smoke
- Stream: `Product Hardening`
- Status: `Next`
- Why it matters: current browser coverage is enough for smoke, but not enough for confidence in deeper authenticated operator flows.
- Evidence:
  - Existing suite centers on `e2e/roadmap-smoke.e2e.ts` and `e2e/grace-critical-smoke.e2e.ts`.
  - Existing QA docs already call deeper authenticated journeys a follow-on hardening item.
- Done when:
  - At least one authenticated journey exists for GRACE operations, one for super-admin launch tooling, and one for billing/integrations.

## Later

### DLV-008 Clean Up Product Narrative And Docs
- Stream: `Repo Hygiene`
- Status: `Later`
- Why it matters: root messaging still describes this as `Indie Kit`, which no longer matches the actual product.
- Evidence:
  - `README.md` still describes the project as `Indie Kit`.
  - `package.json` still uses `"name": "kit"`.
- Done when:
  - Root docs and package metadata reflect Fellowship 360 / GRACE instead of boilerplate branding.

### DLV-009 Reduce Surface Duplication Intentionally
- Stream: `Product Hardening`
- Status: `Later`
- Why it matters: several app routes intentionally redirect into GRACE, which is good for consolidation, but should be documented as a deliberate architecture choice.
- Evidence:
  - `/app/appointments`, `/app/calendar`, `/app/inbox`, `/app/calls`, `/app/pipeline`, `/app/grace-center`, `/app/home`, and `/app/conversations` redirect to GRACE tabs.
- Done when:
  - Navigation and docs clearly describe GRACE as the canonical operating workspace and legacy routes as convenience aliases.

## Deferred

### DLV-010 LemonSqueezy Work Should Stay Deferred Unless Billing Strategy Changes
- Stream: `Deferred`
- Status: `Deferred`
- Why it matters: old todo items mention LemonSqueezy webhooks and billing portal work, but current launch docs say Stripe is the active provider and LemonSqueezy is disabled.
- Evidence:
  - `TODO.todo` still lists unfinished LemonSqueezy work.
  - `docs/GRACE_MASTER_TRACKER.md` says LemonSqueezy is disabled for the new subscription flow.
- Done when:
  - Either the billing strategy changes and the item is re-opened, or the stale todo entries are removed.
