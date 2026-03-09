# GRACE Built-In Sequence Templates (Launch MVP)

Last updated: March 7, 2026

## TPL-001 Visitor Follow-Up

- Trigger: `contacts.created.v1`
- Eligibility: contact `memberStatus` is `visitor` or `prospect`
- Flow:
  - Immediate welcome follow-up message
  - Wait 24h, stop if inbound reply or appointment exists
  - Second follow-up message
  - Wait 72h, stop if inbound reply or appointment exists
  - Create manual escalation task if no engagement
- Logging:
  - Writes follow-up actions to `grace_followup_proposal`
  - Records `sequence=visitor_follow_up` metadata per step

## TPL-002 Missed Call + Message Recovery

- Trigger: `grace.call.missed.v1`
- Source: voice webhook emits event when a call ends without transcript content
- Flow:
  - Log missed call in conversation history
  - Send immediate SMS recovery message
  - Create callback task (1-hour SLA)
  - Wait 2h for reply
  - If no reply: send retry message + create urgent escalation task
- Logging:
  - Writes follow-up actions to `grace_followup_proposal`
  - Records `sequence=missed_call_recovery` metadata per step
