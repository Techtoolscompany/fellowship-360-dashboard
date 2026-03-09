# Inngest Workflow Foundation (GRACE)

Last updated: March 7, 2026

## Canonical Event Taxonomy (v1)

| Event | Producer | Consumer Function | Purpose |
| --- | --- | --- | --- |
| `grace.lead.received.v1` | `POST /api/webhooks/inbound-lead` | `ai-brain-router` | Process new inbound lead with AI triage + CRM writeback |
| `communications.broadcast.send.requested.v1` | `triggerBroadcast` server action | `send-broadcast` | Execute queued SMS/email broadcast delivery |
| `contacts.created.v1` | `createContact` server action | `process-contact-created` | Normalize contact and run post-create workflows |
| `grace.call.missed.v1` | `POST /api/webhooks/voice/grace` (on ended call with no transcript) | `sequence-missed-call-recovery` | Trigger missed-call callback and escalation sequence |
| `test.hello-world.requested.v1` | Internal testing | `hello-world` | Smoke-test Inngest runtime |

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
