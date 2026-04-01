# Inngest Workflow Foundation (GRACE)

Last updated: March 18, 2026

## Canonical Event Taxonomy (v1)

| Event | Producer | Consumer Function | Purpose |
| --- | --- | --- | --- |
| `grace.lead.received.v1` | `POST /api/webhooks/inbound-lead` | `ai-brain-router` | Process new inbound lead with AI triage + CRM writeback |
| `communications.broadcast.send.requested.v1` | `triggerBroadcast` server action | `send-broadcast` | Execute queued SMS/email broadcast delivery |
| `contacts.created.v1` | `createContact` server action | `process-contact-created` | Normalize contact and run post-create workflows |
| `grace.call.missed.v1` | `POST /api/webhooks/voice/grace` (on ended call with no transcript) | `sequence-missed-call-recovery` | Trigger missed-call callback and escalation sequence |
| `test.hello-world.requested.v1` | Internal testing | `hello-world` | Smoke-test Inngest runtime |

## Scheduled Operations

| Schedule | Function | Purpose |
| --- | --- | --- |
| Daily (`13:15 UTC`) | `automation-dispatch-daily-ministry-ops` | Dispatch workflows bound to `ministry.ops.daily.v1` |
| Weekly Monday (`14:15 UTC`) | `automation-dispatch-weekly-ministry-ops` | Dispatch workflows bound to `ministry.ops.weekly.v1` |
| Every 30 minutes | `automation-dead-letter-replay` | Replay due failed automation runs from dead-letter queue |
| Hourly (`:20`) | `grace-service-run-recap-schedule` | Auto-generate post-service recap memories for recently completed service runs |

## Runtime Controls

- Concurrency guard limits active workflow runs (`entered` + `running`) per workflow instance.
- Event dispatch throttling caps how many workflows can fire from a single trigger tick.
- Failed runs are persisted in `automation_dead_letter` with exponential backoff retry windows.
- Replay supports manual invocation and scheduled due-item processing.

## Idempotency Rules

- Every sequence-triggered event includes `data.idempotencyKey`.
- Every producer also sends event `id = idempotencyKey`.
- Every consumer function enforces idempotency via Inngest function config:
  - `idempotency: "event.data.idempotencyKey"`

### Key Derivation

- Lead ingest: hash of `organizationId + normalizedEmail + normalizedMessage`
- Broadcast send: hash of `organizationId + broadcastId`
- Contact created: hash of `organizationId + contactId`

## Retry + Backoff Policy

Inngest applies exponential backoff with jitter between retries.  
The app enforces retry counts by workload profile:

| Profile | Retries | Used By |
| --- | --- | --- |
| `CORE_AUTOMATION` | `5` | `ai-brain-router`, `send-broadcast` |
| `STANDARD` | `3` | `process-contact-created` |
| `SCHEDULED` | `2` | `expire-credits`, `daily-briefing`, `member-retention-check` |
| `LOW_RISK` | `1` | `hello-world` |

## Non-Retriable Failures

Use `NonRetriableError` for hard failures that should not burn retries:

- Missing/disabled AI config for lead processing
- Contact not found for post-create pipeline
- Broadcast not found for the target organization
