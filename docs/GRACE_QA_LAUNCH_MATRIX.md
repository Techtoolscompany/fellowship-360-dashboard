# GRACE Launch QA Matrix

Last updated: March 19, 2026  
Ticket: `QA-001` / `P0-018`  
Status: `Done`

## Current Evidence Snapshot
- Command run: `pnpm test:launch-gate`
- Result: `33` test files, `127` tests passed (Vitest run)
- Command run: `pnpm test:e2e:smoke`
- Result: `4` Playwright smoke tests passed (Chromium)
- New critical-path coverage added:
  - `src/lib/grace/__tests__/ops-health.test.ts`
  - `src/lib/grace/ops-health.ts`
  - `src/lib/inngest/functions/grace-ops-health-monitor.ts`
  - `src/lib/inngest/functions/__tests__/automation-event-dispatcher.test.ts`
  - `src/lib/operations/__tests__/tasks-lifecycle.test.ts`
  - `src/lib/operations/__tests__/conversations-lifecycle.test.ts`
  - `src/lib/operations/__tests__/contacts-lifecycle.test.ts`
  - `src/app/actions/__tests__/contacts-actions.test.ts`
  - `src/app/actions/__tests__/communications-actions.test.ts`
  - `src/app/actions/__tests__/tasks-actions.test.ts`
  - `src/lib/operations/__tests__/prayer-lifecycle.test.ts`
  - `src/app/actions/__tests__/prayer-actions.test.ts`
  - `src/app/actions/__tests__/crud-db.integration.test.ts`
  - `src/app/actions/__tests__/automations-actions.test.ts`
  - `src/app/actions/__tests__/finances-actions.test.ts`
  - `src/lib/super-admin/__tests__/agency-health.test.ts`
  - `src/lib/super-admin/__tests__/deploy-template.test.ts`
  - `src/lib/super-admin/__tests__/launch-report.test.ts`
  - `e2e/roadmap-smoke.e2e.ts`
  - `e2e/grace-critical-smoke.e2e.ts`

## Launch-Critical Coverage Matrix
| Area | Flow | Evidence | Status | Notes |
| --- | --- | --- | --- | --- |
| Security + policy | Grace security guards and provider config safety | `src/lib/grace/__tests__/security.test.ts` | Pass | Core security invariants covered in unit tests. |
| Sequence runtime | Event-driven automation dispatch mapping + retry-safe failure bubbling | `src/lib/inngest/functions/__tests__/automation-event-dispatcher.test.ts` | Pass | Covers contact created, first-time guest, missed call, prayer follow-up triggers. |
| Sequence compliance | Enrollment policy + quiet-hours behavior + workflow validation | `src/lib/automations/__tests__/policy.test.ts`, `src/lib/automations/__tests__/validation.test.ts` | Pass | Covers caps, cooldown, opt-out, and graph validation. |
| App API contracts | Grace config + service-template routes | `src/app/api/app/organizations/current/grace/__tests__/config-route.test.ts`, `src/app/api/app/organizations/current/service-templates/__tests__/routes.test.ts` | Pass | Route behavior and failure handling covered. |
| Core CRUD lifecycle | Appointment/task/conversation/contact lifecycle invariants + action transition guards + DB-integrated smoke | `src/lib/operations/__tests__/appointments-lifecycle.test.ts`, `src/lib/operations/__tests__/tasks-lifecycle.test.ts`, `src/lib/operations/__tests__/conversations-lifecycle.test.ts`, `src/lib/operations/__tests__/contacts-lifecycle.test.ts`, `src/app/actions/__tests__/contacts-actions.test.ts`, `src/app/actions/__tests__/tasks-actions.test.ts`, `src/app/actions/__tests__/communications-actions.test.ts`, `src/app/actions/__tests__/crud-db.integration.test.ts` | Pass | Launch-critical CRUD invariants and DB flow validation are covered. |
| Prayer lifecycle | Active/inactive follow-up and escalation side-effect decisions + action guards + DB integration | `src/lib/prayer/__tests__/routing.test.ts`, `src/lib/operations/__tests__/prayer-lifecycle.test.ts`, `src/app/actions/__tests__/prayer-actions.test.ts`, `src/app/actions/__tests__/crud-db.integration.test.ts` | Pass | Routing, lifecycle transitions, action guards, and DB smoke coverage are validated. |
| Financial accountability | Weekly digest generation + normalization | `src/app/actions/__tests__/finances-actions.test.ts`, `src/lib/inngest/functions/finance-weekly-digest.ts` | Pass | Finance now included in launch branch with weekly digest runtime and normalized weekly report checks. |
| Approval SLA monitoring | Queue-age SLA evaluation and alert-trigger logic | `src/lib/grace/ops-health.ts`, `src/lib/grace/__tests__/ops-health.test.ts`, `src/lib/inngest/functions/grace-ops-health-monitor.ts` | Pass | Shared metrics engine and scheduled monitor now enforce alerting for SLA breaches. |
| Runtime failure dashboard + alerting | 24h workflow failure-rate computation, top-failure breakdowns, and alert trigger | `src/lib/grace/ops-health.ts`, `src/lib/grace/__tests__/ops-health.test.ts`, `src/app/(in-app)/(organization)/app/grace/page.tsx`, `src/lib/inngest/functions/grace-ops-health-monitor.ts` | Pass | Dashboard and scheduled monitor share the same thresholds and aggregation logic. |
| Agency health board | Super-admin org health classification, filters, and readiness prioritization | `src/lib/super-admin/agency-health.ts`, `src/lib/super-admin/__tests__/agency-health.test.ts`, `src/app/api/super-admin/organizations/health/route.ts`, `src/app/super-admin/health/page.tsx` | Pass | `critical/degraded/healthy` thresholds and board filters validated with unit coverage. |
| Agency bulk deploy + launch report | Bulk template deployment outcomes and launch report payload/CSV generation | `src/lib/super-admin/deploy-template.ts`, `src/lib/super-admin/__tests__/deploy-template.test.ts`, `src/lib/super-admin/launch-report.ts`, `src/lib/super-admin/__tests__/launch-report.test.ts`, `src/app/api/super-admin/automations/deploy-template/route.ts`, `src/app/api/super-admin/organizations/[id]/launch-report/route.ts` | Pass | Agency control-layer endpoints are covered for idempotent deploy and launch-report export contract. |
| Browser E2E | GRACE-first route guards and launch pages load reliably | `e2e/roadmap-smoke.e2e.ts`, `e2e/grace-critical-smoke.e2e.ts`, `playwright.config.ts`, `pnpm test:e2e:smoke` | Pass | Route-level GRACE-first and auth-boundary behavior are validated in Chromium smoke. |

## Open Risks
- No remaining launch-blocking (`P0`) QA gaps identified as of March 19, 2026.
- Residual non-blocking risk: deeper authenticated browser journeys remain a follow-on expansion item for Week 4 (`P1`) hardening.
