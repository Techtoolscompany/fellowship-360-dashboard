# GRACE P0 Backlog (Implementation Tickets)

Last updated: March 7, 2026  
Scope: Immediate launch-critical build for AI-run ministry operations.

Statuses: `Not Started`, `Scoping`, `In Progress`, `Blocked`, `Done`  
Default owner mapping: Platform, AI Platform, App Eng, Frontend, Workflow, Data, QA

## P0-001 Tenant-Safe Grace Sessions
- Priority: `P0`
- Owner: `Platform`
- Status: `Done`
- ETA: `Week 1`
- Depends on: None
- Goal: Ensure `sessionId` cannot cross organizations.
- Acceptance Criteria:
  - Session lookup validates both `sessionId` and `organizationId`.
  - Cross-org session access attempts fail closed.
  - Regression test covers hostile session reuse.

## P0-002 Remove Tool Policy Bypass
- Priority: `P0`
- Owner: `Platform`
- Status: `Done`
- ETA: `Week 1`
- Depends on: `P0-001`
- Goal: Route all Grace tool execution through policy + approvals.
- Acceptance Criteria:
  - Direct tool route cannot bypass approval rules.
  - High-risk actions queue approvals consistently.
  - Audit logs record attempted and executed actions.

## P0-003 Public Endpoint Hardening
- Priority: `P0`
- Owner: `Platform`
- Status: `Done`
- ETA: `Week 1`
- Depends on: None
- Goal: Protect public chat/webhook endpoints from abuse.
- Acceptance Criteria:
  - Strong auth or signature verification on inbound endpoints.
  - Route-level rate limits on all public Grace paths.
  - Alerting for repeated auth failures.

## P0-004 Per-Org AI Provider Resolution
- Priority: `P0`
- Owner: `AI Platform`
- Status: `Done`
- ETA: `Week 1`
- Depends on: `P0-003`
- Goal: Core router uses organization-specific provider config.
- Acceptance Criteria:
  - Router resolves model credentials per org.
  - Fallback behavior is explicit and safe.
  - Tenant A config never leaks into Tenant B execution.

## P0-005 Action Outcome Visibility in Workspace
- Priority: `P0`
- Owner: `Frontend`
- Status: `Done`
- ETA: `Week 2`
- Depends on: `P0-002`, `P0-004`
- Goal: Humans can see what Grace actually did.
- Acceptance Criteria:
  - Each action displays executed/queued/failed/retried status.
  - Approval queue shows action payload and reason.
  - Errors are actionable for operators.

## P0-006 Service Template Data Model
- Priority: `P0`
- Owner: `App Eng`
- Status: `Done`
- ETA: `Week 2`
- Depends on: None
- Goal: Define reusable run-of-service templates.
- Acceptance Criteria:
  - Template schema supports service type, roles, timeline steps, owners.
  - Supports paid staff and volunteer role slots.
  - CRUD available for template management.

## P0-007 Staffing Assignment Engine
- Priority: `P0`
- Owner: `App Eng`
- Status: `In Progress`
- ETA: `Week 2`
- Depends on: `P0-006`
- Goal: Auto-assign staff/volunteers by role and availability.
- Acceptance Criteria:
  - Assignment supports availability + role match.
  - Double-booking/conflicts are blocked.
  - Manual override remains available.

## P0-008 Service Confirmation Workflow
- Priority: `P0`
- Owner: `Workflow`
- Status: `Not Started`
- ETA: `Week 3`
- Depends on: `P0-007`, `P0-010`
- Goal: Run reminder confirmations at T-48/T-24/T-2.
- Acceptance Criteria:
  - Sends reminders through configured channels.
  - Tracks confirmation status per assignee.
  - Escalates unconfirmed critical roles.

## P0-009 Day-Of Run Board
- Priority: `P0`
- Owner: `Frontend`
- Status: `Not Started`
- ETA: `Week 3`
- Depends on: `P0-006`, `P0-007`
- Goal: Single board to run service execution live.
- Acceptance Criteria:
  - Shows current step, next step, countdown timers.
  - Shows role fill status and no-show flags.
  - Supports quick actions (reassign, alert, add task).

## P0-010 Workflow Runtime Foundations (Inngest)
- Priority: `P0`
- Owner: `Platform`
- Status: `Done`
- ETA: `Week 2`
- Depends on: None
- Goal: Standardize event and execution model for sequences.
- Acceptance Criteria:
  - Canonical event taxonomy created.
  - Idempotency keys on all sequence-triggered actions.
  - Retry/backoff policy documented and enforced.

## P0-011 Sequence Builder MVP (Node Editor)
- Priority: `P0`
- Owner: `Frontend`
- Status: `Not Started`
- ETA: `Week 3`
- Depends on: `P0-010`
- Goal: In-app GHL-style builder for custom flows.
- Acceptance Criteria:
  - Node types: trigger, delay, condition, action, stop.
  - Save/load/publish basic workflow.
  - Validation blocks broken flow publication.

## P0-012 Template Library + One-Click Install
- Priority: `P0`
- Owner: `Workflow`
- Status: `Not Started`
- ETA: `Week 3`
- Depends on: `P0-011`
- Goal: Users can install prebuilt sequences without building.
- Acceptance Criteria:
  - Library categories and template metadata exist.
  - Install creates runnable workflow instance.
  - Safe defaults applied (quiet hours, caps, opt-out).

## P0-013 Visitor Follow-Up Sequence Template
- Priority: `P0`
- Owner: `Workflow`
- Status: `Done`
- ETA: `Week 3`
- Depends on: `P0-012`
- Goal: Automate first-touch visitor nurture.
- Acceptance Criteria:
  - Trigger: new visitor contact/source.
  - Multi-step follow-up with delays and branch logic.
  - Exit rules for reply/booked/opt-out.

## P0-014 Missed Call + Message Recovery Template
- Priority: `P0`
- Owner: `Workflow`
- Status: `Done`
- ETA: `Week 3`
- Depends on: `P0-012`
- Goal: Convert missed calls into completed follow-up.
- Acceptance Criteria:
  - Trigger on missed call/voicemail.
  - Sends immediate follow-up message.
  - Creates callback task and escalates if no response.

## P0-015 Broadcast-Sequence Integration
- Priority: `P0`
- Owner: `App Eng`
- Status: `Not Started`
- ETA: `Week 3`
- Depends on: `P0-010`, `P0-012`
- Goal: Allow sequences to trigger segmented broadcasts.
- Acceptance Criteria:
  - Sequence action can enqueue broadcast send.
  - Delivery and failure metrics are captured.
  - Sequence logs show broadcast linkage.

## P0-016 Weekly Financial Digest Pipeline
- Priority: `P0`
- Owner: `Data`
- Status: `Not Started`
- ETA: `Week 3`
- Depends on: `P0-010`
- Goal: Grace generates weekly financial accountability summary.
- Acceptance Criteria:
  - Scheduled weekly job runs automatically.
  - Report includes totals by source and fund.
  - Digest is persisted and available in Grace workspace.

## P0-017 Giving Source/Fund Normalization
- Priority: `P0`
- Owner: `Data`
- Status: `Not Started`
- ETA: `Week 3`
- Depends on: `P0-016`
- Goal: Ensure weekly report data is reliable.
- Acceptance Criteria:
  - Canonical source taxonomy defined and mapped.
  - Fund attribution complete for all donation records.
  - Unknown/unmapped entries surface in exception report.

## P0-018 Launch Readiness QA Matrix
- Priority: `P0`
- Owner: `QA`
- Status: `Not Started`
- ETA: `Week 3`
- Depends on: `P0-001`..`P0-017`
- Goal: Verify launch-critical paths end-to-end.
- Acceptance Criteria:
  - Test matrix covers security, policy, CRUD, workflows, finance digest.
  - All P0 flows have pass/fail evidence.
  - Remaining known risks are documented with owner and date.

## Suggested Execution Order
1. `P0-001` to `P0-004` (safety and runtime correctness)
2. `P0-010` (workflow backbone)
3. `P0-005` + `P0-006` + `P0-007` (operator trust + staffing model)
4. `P0-011` + `P0-012` + `P0-013` + `P0-014` + `P0-015` (GHL-style sequence capability)
5. `P0-008` + `P0-009` (service-day execution)
6. `P0-016` + `P0-017` (weekly financial accountability)
7. `P0-018` (final launch gate)
