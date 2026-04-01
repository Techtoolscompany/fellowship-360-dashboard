# GRACE Built-In Sequence Templates (Launch MVP)

Last updated: March 17, 2026

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

## TPL-003 First-Time Guest -> Appointment

- Trigger: `grace.guest.first-time-appointment.requested.v1`
- Source:
  - Pipeline item created in first-time guest stage
  - Pipeline item moved into first-time guest stage
  - AI lead categorization into first-time guest stage
- Eligibility:
  - Stage name matches first/new + guest/visitor semantics
  - Contact has SMS or email channel
- Flow:
  - Immediate appointment invite outreach
  - Wait 24h, stop if inbound reply or appointment booked
  - Reminder appointment invite
  - Wait 48h, stop if inbound reply or appointment booked
  - Create manual outreach task if still no engagement
- Logging:
  - Writes follow-up actions to `grace_followup_proposal`
  - Records `sequence=first_time_guest_appointment` metadata per step
  - Uses `grace_message.providerMessageId` dedupe keys

## TPL-004 Prayer Request Follow-Up

- Trigger: `grace.prayer-request.followup.requested.v1`
- Flow:
  - Route urgent/critical requests through immediate escalation branch
  - Send acknowledgment + care check-in for standard urgency
  - Exit with escalation or completion outcome markers
- Logging:
  - Records `sequence=prayer_request_followup` metadata in workflow run traces

## TPL-005 Appointment Reminder + No-Show Recovery

- Trigger: `appointments.scheduled.v1`
- Flow:
  - T-48 reminder
  - T-24 reminder
  - Branch on no-show outcome
  - Start recovery touch if no-show is confirmed
- Logging:
  - Records `sequence=appointment_reminders_no_show_recovery` metadata in workflow run traces

## TPL-006 New Member 30-Day

- Trigger: `contacts.member.created.v1`
- Flow:
  - Day 0 welcome touch
  - Day 3 next-steps touch
  - Day 10 groups/serving invitation
  - Day 20 engagement checkpoint with optional pastoral task
  - Day 30 membership pathway recap
- Logging:
  - Records `sequence=new_member_30_day` metadata in workflow run traces

## TPL-007 Volunteer Onboarding

- Trigger: `volunteers.created.v1`
- Flow:
  - Send role packet and expectations
  - Wait 24h and check acknowledgment
  - If not acknowledged, send training reminder
  - Wait 72h and create leader follow-up task
- Logging:
  - Records `sequence=volunteer_onboarding` metadata in workflow run traces

## TPL-008 Inactive Member Re-Engagement

- Trigger: `contacts.reengagement.requested.v1`
- Flow:
  - First re-engagement touch
  - Wait 72h for response
  - Second touch if still unresponsive
  - Wait 7 days and escalate to care team if inactivity persists
- Logging:
  - Records `sequence=inactive_member_reengagement` metadata in workflow run traces

## TPL-009 Event RSVP + Reminder

- Trigger: `events.rsvp.created.v1`
- Flow:
  - Immediate RSVP confirmation
  - 72-hour reminder
  - 24-hour attendance confirmation branch
  - Day-of details or reconfirmation prompt
- Logging:
  - Records `sequence=event_rsvp_reminders` metadata in workflow run traces
