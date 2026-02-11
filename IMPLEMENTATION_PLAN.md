# Fellowship 360 — Master Implementation Plan

> **Last Updated:** February 11, 2026  
> **Status:** Core CRM foundation + GRACE foundation complete; remaining work tracked below  
> **Project:** Multi-tenant Church CRM + hardwired GRACE AI platform

---

## 1) Product Goal

Ship a production-safe, multi-tenant church operating system where:
- Church staff run daily CRM operations (contacts, ministries, giving, pipeline, scheduling, prayer, communications).
- GRACE acts as receptionist + internal copilot across voice/SMS/in-app channels.
- Agency-managed providers are default (voice/SMS), with BYO enabled where appropriate (email now; Slack/Telegram later).

---

## 2) Scope Map (Comprehensive)

### A. Core CRM Platform
- Organizations, memberships, roles, permissions.
- Contacts and household/church contact management.
- Ministries, volunteers, tasks, calendar/events, operations/appointments.
- Prayer requests lifecycle.
- Donations/donors/pledges reporting.
- Pipeline and follow-up tracking.
- Broadcasts and communication templates.

### B. GRACE Platform
- Runtime orchestration (`grace-runtime`).
- Tool router with policy enforcement (`claw-router`).
- Session/call/message/audit persistence.
- Public receptionist flows (voice/SMS/web).
- Internal copilot (in-app staff chat + approvals).

### C. Channel & Provider Layer
- Agency-managed voice and SMS (Retell/TextBee).
- BYO email support (encrypted credentials).
- Future BYO Slack/Telegram connector support.

### D. Multi-Tenant Onboarding
- Org creation/setup.
- Contacts import (CSV mapping).
- Knowledge base seeding for GRACE.
- Provider and policy configuration.

### E. Reliability, Security, and Ops
- Tenant isolation and RBAC enforcement.
- Webhook signature checks, rate limiting, idempotency.
- Tool audit and observability (logs/errors/alerts).
- Test coverage (unit/integration/E2E for critical flows).

---

## 3) Current Implementation Status

### Completed ✅

#### Core CRM (Phases 1-5)
- Core schema and server actions implemented and org-scoped.
- Major app routes wired to live data, including:
  - `/app/calls`
  - `/app/reports`
  - `/app/seed`
- Dashboards wired with live aggregates.
- Reports CSV export implemented (client-side).

#### GRACE Foundation
- Added GRACE modules under `src/lib/grace/*`:
  - runtime
  - router (classifier/slots/planner/executor)
  - policy (rules/engine/approvals)
  - tools registry + execution helpers
  - channel utilities/adapters
- Added GRACE schemas:
  - `grace_sessions`
  - `grace_calls`
  - `grace_messages`
  - `grace_tool_audit`
  - `grace_knowledge`
  - `grace_approvals`
  - `grace_policy_configs`
  - `provider_config`
- Added APIs:
  - `POST /api/webhooks/voice/grace`
  - `POST /api/webhooks/sms/grace`
  - `POST /api/grace/copilot/chat`
  - `POST /api/grace/actions/execute`
  - `GET|PATCH /api/app/organizations/current/grace/config`
  - `GET|POST /api/grace/tools/[...tool]`
- Added UI:
  - `/app/grace-center`
  - `/app/settings/grace`

#### Provider Security/Policy
- BYO provider secrets encrypted server-side at write.
- Secrets redacted from read responses (`secretStatus` only).
- Voice/SMS locked to agency-managed mode.
- BYO currently allowed for email only (Slack/Telegram reserved for later).

#### Validation
- `pnpm lint` passing.
- `pnpm build` passing.

### Known Non-Blocking Issues ⚠️
- `baseline-browser-mapping` warning during build.
- `tailwind.config.ts` module type warning during build.

---

## 4) Remaining Work by Track

## Track A — Core CRM Completion (Still Required)

### A1. Create/Edit workflows (Phase 6 continuation)
1. Appointments
- Create modal + edit flow
- Validation + optimistic refresh

2. Prayer Requests
- Create + status/edit flow
- Assignment/follow-up date handling

3. Broadcasts
- Compose/send flow
- Edit draft flow
- Segment selection UX (ministries/tags)

4. Ministries
- Create + edit flow

5. Pledges
- Create + edit flow

6. Calendar events
- Create/edit event modals

### A2. Query-backed filters and scale polish
- Replace remaining UI-only filters/search with server/query-backed filters.
- Add pagination where datasets can grow large.

### A3. Reports export hardening (optional but recommended)
- Add server-side export path for auditability.

---

## Track B — GRACE Runtime Completion (Highest Priority)

### B1. Provider runtime resolver
- Resolve active provider by `organizationId + channel`.
- Decrypt secrets only in server runtime path.
- Fallback chain:
  - org config (if allowed/valid)
  - agency-managed env config
  - fail with actionable audit record

### B2. Wire adapters to resolver
- SMS adapter: send with resolved TextBee credentials.
- Voice handlers: org-aware signature/agent handling while policy remains agency-managed.
- Email tool: send with BYO config when enabled.

### B3. Provider health & test hooks
- Add "test connection" for email BYO.
- Surface connected/error states in `/app/settings/grace`.

### B4. GRACE workflow completion
- Knowledge retrieval quality and confidence fallback.
- Prayer urgency -> deterministic staff alert path.
- Appointment flow end-to-end (availability -> propose -> book -> confirm).
- Escalation/handoff timeline in Grace Center.

---

## Track C — Reliability, Security, Compliance

### C1. Idempotency and duplicate protection
- Enforce unique idempotency keys on webhook/tool paths.
- Prevent duplicate writes from retries.

### C2. Booking conflict hardening
- Transactional conflict checks for appointment booking.

### C3. Audit completeness
- Guarantee `grace_tool_audit` entries for all tool outcomes.

### C4. Security checks
- Full tenant isolation pass across read/write paths.
- RBAC pass for public channels vs staff copilot.
- Webhook signature + rate limit consistency review.

---

## Track D — Onboarding and Multi-Church Scale

### D1. Onboarding sequence
- Organization profile setup wizard.
- Contact CSV import mapping and validation.
- Knowledge base seed templates.

### D2. Provider model UX
- Agency-managed defaults prefilled for voice/SMS.
- BYO flow for email (then Slack/Telegram when released).

### D3. Policy setup UX
- Approval thresholds.
- Escalation rules.
- High-risk tool controls.

---

## Track E — Testing and Launch Readiness

### E1. Unit tests
- Intent classification.
- Slot state machine.
- Policy decisions.
- Provider mode/rule enforcement.

### E2. Integration tests
- Webhook -> session/call/message persistence.
- Router -> tool execution -> audit rows.
- Approval execute/reject lifecycle.

### E3. E2E tests (critical demos)
1. Inbound SMS prayer request (urgent) -> prayer record + alert + session log.
2. Voice FAQ request -> KB answer + call log/transcript.
3. Appointment request -> availability + booking without double-booking.
4. Copilot proposes action -> staff approves -> action executes + audit.
5. Cross-tenant access attempt fails.

### E4. Ops
- Sentry coverage for Grace and webhook endpoints.
- Alerting for webhook failures/tool timeouts/provider send failures.

---

## 5) Execution Order (No Scope Loss)

1. **Track B** (GRACE provider runtime + receptionist flow completion)  
2. **Track A** (remaining CRM create/edit workflows and broadcast segmentation UX)  
3. **Track C** (reliability/security hardening)  
4. **Track D** (onboarding + multi-church operationalization)  
5. **Track E** (test/ops lock for launch)

---

## 6) Definition of Done (Full Application)

The app is considered complete when all conditions below are true:

### CRM completion
- Remaining create/edit workflows are functional and validated.
- Query-backed filters are in place for large lists.

### GRACE completion
- Voice/SMS inbound create/update GRACE sessions.
- GRACE answers org-scoped knowledge correctly.
- Prayer urgency path works reliably.
- Appointment booking prevents duplicates/conflicts.
- Every tool execution is audited.
- Staff copilot can propose + approve + execute actions.

### Security/compliance
- Every read/write remains tenant-scoped server-side.
- RBAC and approval gates enforced by server policy.
- Webhook signature validation + idempotency pass complete.

### Operational readiness
- Core flows covered by automated tests.
- Build/lint pass in CI.
- Error tracking + alerts configured for Grace critical paths.

---

## 7) Quick Resume

1. `cd /Users/studiocomp/Documents/fellowship-360-app`
2. `pnpm dev`
3. Use `/app/settings/grace` and `/app/grace-center` for GRACE progression.
4. Start at **Track B1** (provider runtime resolver + decrypted runtime usage).
