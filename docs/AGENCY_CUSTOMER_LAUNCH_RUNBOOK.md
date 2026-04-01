# Agency Customer Launch Runbook

Last updated: March 19, 2026  
Owner: Agency operator + platform lead

## 1. Technical Go/No-Go (T-24h to T-1h)

Run these commands from project root:

```bash
pnpm demo:readiness
pnpm demo:operationalize
pnpm launch:preflight
pnpm lint
pnpm exec tsc --noEmit --pretty false
pnpm test:launch-gate
pnpm test:e2e:smoke
```

Release criteria:
- `demo:operationalize` returns `0` FAIL checks for `Fellowship 360` demo org readiness.
- `launch:preflight` has `0` FAIL checks.
- `lint`, `typecheck`, launch-gate tests, and smoke E2E all pass.
- Super-admin features load in production:
  - `/super-admin/health`
  - `/super-admin/automations/deploy`
  - `/super-admin/organizations/:id` with **Export Launch Report**

Required env for demo-org comms readiness:
- `GEMINI_API_KEY`
- `ELEVENLABS_API_KEY`
- `TEXTBEE_API_KEY`
- `TEXTBEE_BASE_URL`
- `TEXTBEE_WEBHOOK_SECRET`
- `RETELL_WEBHOOK_SECRET`
- `SMS_GATEWAY_API_KEY`

## 2. Pilot Rollout (Day 0)

Target: 3 pilot churches before full customer rollout.

Steps:
1. In `/super-admin/health`, filter `critical` and resolve top blockers first.
2. In `/super-admin/automations/deploy`, deploy one approved template to pilot orgs.
3. Export launch report CSV for each pilot org and send to client owner.
4. Validate role access policy for each pilot org:
   - Finance users can open finance flows.
   - Report users can open report flows.
5. Monitor for 2-4 hours:
   - AI/action error rate
   - SMS heartbeat freshness
   - Automation run failures

Pilot acceptance:
- No P0 incidents in pilot window.
- Template deploy completes with expected statuses.
- Launch report exports require no manual correction.

## 3. Full Rollout (Day 1-2)

1. Deploy approved templates to remaining launch orgs in batches.
2. Keep `/super-admin/health` open as command board during rollout.
3. Re-export launch reports for all customer handoffs.
4. Log incidents and resolutions in internal channel in real time.

## 4. Rollback Triggers

Rollback immediately if any of these occur:
- Sustained `critical` status growth (>20% of launch cohort within 30 minutes).
- AI/action error rate >= 40% for launch cohort with >=20 events per org.
- SMS heartbeat failures across multiple orgs (>60 minutes stale).
- Bulk deploy endpoint failures affecting >25% of target orgs in a run.

Rollback actions:
1. Pause further bulk deploy runs.
2. Revert recently deployed template changes for affected orgs.
3. Notify pilot org admins with incident status and ETA.
4. Resume rollout only after root cause is fixed and revalidated.

## 5. Customer-Facing Handoff Pack

Send each church:
- Launch report CSV
- Enabled automations list
- Role access policy snapshot
- Support escalation contact + office hours for launch week

## 6. Post-Launch (first 7 days)

- Daily: run `pnpm launch:preflight` and monitor `/super-admin/health`.
- Track and triage any `critical` orgs within 30 minutes.
- Convert recurring issues into backlog with owner + due date.
