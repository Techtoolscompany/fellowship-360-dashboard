import { INNGEST_EVENTS } from "@/lib/inngest/events";
import type { AutomationDefinition, AutomationTemplate } from "./types";
export { createBuilderStarterDefinition } from "./editor";

function smsAction(messageText: string) {
  return {
    actionType: "send_sms",
    messageText,
  };
}

function emailAction(emailSubject: string, emailBody: string) {
  return {
    actionType: "send_email",
    emailSubject,
    emailBody,
  };
}

function taskAction(taskTitle: string, taskInstructions: string) {
  return {
    actionType: "create_task",
    taskTitle,
    taskInstructions,
  };
}

function delayConfig(
  amount: number,
  unit: "minutes" | "hours" | "days" | "weeks",
  extra: Record<string, unknown> = {}
) {
  return {
    amount,
    unit,
    ...extra,
  };
}

function conditionConfig(
  conditionType: string,
  extra: Record<string, unknown> = {}
) {
  return {
    conditionType,
    ...extra,
  };
}

const TEMPLATE_CATALOG: AutomationTemplate[] = [
  {
    key: "visitor_follow_up",
    name: "Visitor Follow-Up",
    description:
      "Welcome new visitors, check in after 24h, and escalate to human outreach when no response arrives.",
    category: "Follow-Up",
    triggerEvent: INNGEST_EVENTS.CONTACT_CREATED,
    mode: "template",
    recommendedChannels: ["sms", "email"],
    definition: {
      version: 1,
      startNodeId: "trigger_contact_created",
      nodes: [
        {
          id: "trigger_contact_created",
          type: "trigger",
          label: "New visitor contact created",
          nextIds: ["action_send_welcome"],
        },
        {
          id: "action_send_welcome",
          type: "action",
          label: "Send welcome follow-up",
          config: smsAction(
            "Hi {{ contact.firstName | default: 'there' }}, thanks for visiting. We are glad you connected with us and would love to help you take a next step."
          ),
          nextIds: ["delay_24_hours"],
        },
        {
          id: "delay_24_hours",
          type: "delay",
          label: "Wait 24 hours",
          config: delayConfig(24, "hours", {
            relativeTo: "workflow_start",
          }),
          nextIds: ["condition_replied_or_booked"],
        },
        {
          id: "condition_replied_or_booked",
          type: "condition",
          label: "Replied or booked?",
          config: conditionConfig("engaged", {
            matchValue: "replied_or_booked",
            lookbackHours: 24,
          }),
          nextIds: ["stop_engaged", "action_send_second_touch"],
        },
        {
          id: "action_send_second_touch",
          type: "action",
          label: "Send second follow-up",
          config: emailAction(
            "We would love to help you get connected",
            "<p>Hi {{ contact.firstName | default: 'there' }},</p><p>Just checking in from the church team. If you need prayer, service times, or help planning your next visit, reply here and we will follow up.</p>"
          ),
          nextIds: ["delay_72_hours"],
        },
        {
          id: "delay_72_hours",
          type: "delay",
          label: "Wait 72 hours",
          config: delayConfig(72, "hours", {
            relativeTo: "workflow_start",
          }),
          nextIds: ["condition_second_check"],
        },
        {
          id: "condition_second_check",
          type: "condition",
          label: "Still no engagement?",
          config: conditionConfig("contact_replied", {
            matchValue: "no_reply",
            lookbackHours: 72,
          }),
          nextIds: ["action_create_manual_task", "stop_engaged"],
        },
        {
          id: "action_create_manual_task",
          type: "action",
          label: "Create manual outreach task",
          config: taskAction(
            "Visitor follow-up outreach needed",
            "No response after the automated visitor follow-up sequence. Call, text, or email the contact and log the result."
          ),
          nextIds: ["stop_escalated"],
        },
        {
          id: "stop_engaged",
          type: "stop",
          label: "Exit: visitor engaged",
          nextIds: [],
        },
        {
          id: "stop_escalated",
          type: "stop",
          label: "Exit: escalated to staff",
          nextIds: [],
        },
      ],
    },
  },
  {
    key: "missed_call_recovery",
    name: "Missed Call Recovery",
    description:
      "Convert unanswered calls into follow-up conversations with immediate response and callback escalation.",
    category: "Follow-Up",
    triggerEvent: INNGEST_EVENTS.GRACE_MISSED_CALL_RECOVERY_REQUESTED,
    mode: "template",
    recommendedChannels: ["sms", "voice"],
    definition: {
      version: 1,
      startNodeId: "trigger_missed_call",
      nodes: [
        {
          id: "trigger_missed_call",
          type: "trigger",
          label: "Missed call event",
          nextIds: ["action_send_recovery_sms"],
        },
        {
          id: "action_send_recovery_sms",
          type: "action",
          label: "Send immediate recovery SMS",
          config: smsAction(
            "Sorry we missed your call. Reply here or call back and we will help you right away."
          ),
          nextIds: ["action_create_callback_task"],
        },
        {
          id: "action_create_callback_task",
          type: "action",
          label: "Create callback task",
          config: taskAction(
            "Return missed call",
            "A missed call came in and the recovery sequence started. Call back, text, or log a reason if the caller already responded."
          ),
          nextIds: ["delay_2_hours"],
        },
        {
          id: "delay_2_hours",
          type: "delay",
          label: "Wait 2 hours",
          config: delayConfig(2, "hours", {
            relativeTo: "workflow_start",
          }),
          nextIds: ["condition_reply_received"],
        },
        {
          id: "condition_reply_received",
          type: "condition",
          label: "Reply received?",
          config: conditionConfig("contact_replied", {
            matchValue: "reply_received",
            lookbackHours: 2,
          }),
          nextIds: ["stop_recovered", "action_send_retry_and_escalate"],
        },
        {
          id: "action_send_retry_and_escalate",
          type: "action",
          label: "Retry SMS and escalate",
          config: smsAction(
            "We tried to reach you earlier. Reply here and we will route you to the right person."
          ),
          nextIds: ["stop_escalated"],
        },
        {
          id: "stop_recovered",
          type: "stop",
          label: "Exit: call recovered",
          nextIds: [],
        },
        {
          id: "stop_escalated",
          type: "stop",
          label: "Exit: escalated",
          nextIds: [],
        },
      ],
    },
  },
  {
    key: "first_time_guest_appointment",
    name: "First-Time Guest to Appointment",
    description:
      "Invite first-time guests to book an appointment and hand off when automation cannot secure a response.",
    category: "Appointments",
    triggerEvent: INNGEST_EVENTS.GRACE_FIRST_TIME_GUEST_APPOINTMENT_REQUESTED,
    mode: "template",
    recommendedChannels: ["sms", "email"],
    definition: {
      version: 1,
      startNodeId: "trigger_first_time_guest",
      nodes: [
        {
          id: "trigger_first_time_guest",
          type: "trigger",
          label: "First-time guest stage entered",
          nextIds: ["action_send_appointment_invite"],
        },
        {
          id: "action_send_appointment_invite",
          type: "action",
          label: "Send appointment invite",
          config: smsAction(
            "Hi {{ contact.firstName | default: 'there' }}, we would love to set up a time to connect and help you take a next step."
          ),
          nextIds: ["delay_24_hours"],
        },
        {
          id: "delay_24_hours",
          type: "delay",
          label: "Wait 24 hours",
          config: delayConfig(24, "hours", {
            relativeTo: "workflow_start",
          }),
          nextIds: ["condition_replied_or_booked"],
        },
        {
          id: "condition_replied_or_booked",
          type: "condition",
          label: "Replied or booked?",
          config: conditionConfig("engaged", {
            matchValue: "replied_or_booked",
            lookbackHours: 24,
          }),
          nextIds: ["stop_conversion", "action_send_appointment_reminder"],
        },
        {
          id: "action_send_appointment_reminder",
          type: "action",
          label: "Send reminder",
          config: emailAction(
            "Let's plan your next conversation",
            "<p>Hi {{ contact.firstName | default: 'there' }},</p><p>Just a quick reminder that we would love to meet with you. Reply anytime and we will help schedule the next step.</p>"
          ),
          nextIds: ["delay_48_hours"],
        },
        {
          id: "delay_48_hours",
          type: "delay",
          label: "Wait 48 hours",
          config: delayConfig(48, "hours", {
            relativeTo: "workflow_start",
          }),
          nextIds: ["condition_final_check"],
        },
        {
          id: "condition_final_check",
          type: "condition",
          label: "Still no reply?",
          config: conditionConfig("contact_replied", {
            matchValue: "no_reply",
            lookbackHours: 48,
          }),
          nextIds: ["action_manual_outreach", "stop_conversion"],
        },
        {
          id: "action_manual_outreach",
          type: "action",
          label: "Create manual outreach task",
          config: taskAction(
            "First-time guest appointment follow-up",
            "The appointment invite sequence did not produce a reply or booking. Follow up manually and log the response."
          ),
          nextIds: ["stop_escalated"],
        },
        {
          id: "stop_conversion",
          type: "stop",
          label: "Exit: replied/booked",
          nextIds: [],
        },
        {
          id: "stop_escalated",
          type: "stop",
          label: "Exit: escalated",
          nextIds: [],
        },
      ],
    },
  },
  {
    key: "prayer_request_followup",
    name: "Prayer Request Follow-Up",
    description:
      "Acknowledge urgent prayer requests immediately and escalate care paths when urgency remains high.",
    category: "Care",
    triggerEvent: INNGEST_EVENTS.GRACE_PRAYER_REQUEST_FOLLOWUP_REQUESTED,
    mode: "template",
    recommendedChannels: ["sms", "email", "voice"],
    definition: {
      version: 1,
      startNodeId: "trigger_prayer_request",
      nodes: [
        {
          id: "trigger_prayer_request",
          type: "trigger",
          label: "Prayer request submitted",
          nextIds: ["condition_urgency_check"],
        },
        {
          id: "condition_urgency_check",
          type: "condition",
          label: "Urgency is critical?",
          config: conditionConfig("field_matches", {
            fieldKey: "urgency",
            matchValue: "critical",
          }),
          nextIds: ["action_immediate_escalation", "action_standard_ack"],
        },
        {
          id: "action_immediate_escalation",
          type: "action",
          label: "Page on-call pastor",
          config: taskAction(
            "Critical prayer request escalation",
            "This prayer request is marked critical. Notify the on-call pastor and respond with care immediately."
          ),
          nextIds: ["stop_escalated"],
        },
        {
          id: "action_standard_ack",
          type: "action",
          label: "Send acknowledgment",
          config: smsAction(
            "We received your prayer request and will be praying for you. If you need anything else, reply here."
          ),
          nextIds: ["delay_24_hours"],
        },
        {
          id: "delay_24_hours",
          type: "delay",
          label: "Wait 24 hours",
          config: delayConfig(24, "hours", {
            relativeTo: "workflow_start",
          }),
          nextIds: ["action_followup_checkin"],
        },
        {
          id: "action_followup_checkin",
          type: "action",
          label: "Send care check-in",
          config: emailAction(
            "Prayer follow-up",
            "<p>We wanted to check in and see how you are doing. If you would like additional prayer or support, reply and our team will reach out.</p>"
          ),
          nextIds: ["stop_completed"],
        },
        {
          id: "stop_escalated",
          type: "stop",
          label: "Exit: critical escalation",
          nextIds: [],
        },
        {
          id: "stop_completed",
          type: "stop",
          label: "Exit: follow-up completed",
          nextIds: [],
        },
      ],
    },
  },
  {
    key: "appointment_reminders_no_show_recovery",
    name: "Appointment Reminder and No-Show Recovery",
    description:
      "Send appointment reminders and recover no-show outcomes with automated follow-up plus escalation.",
    category: "Appointments",
    triggerEvent: "appointments.scheduled.v1",
    mode: "template",
    recommendedChannels: ["sms", "email"],
    definition: {
      version: 1,
      startNodeId: "trigger_appointment_scheduled",
      nodes: [
        {
          id: "trigger_appointment_scheduled",
          type: "trigger",
          label: "Appointment scheduled",
          nextIds: ["delay_48_hours_before"],
        },
        {
          id: "delay_48_hours_before",
          type: "delay",
          label: "Wait until T-48",
          config: delayConfig(48, "hours", {
            relativeTo: "event_start",
            direction: "before",
          }),
          nextIds: ["action_send_t48_reminder"],
        },
        {
          id: "action_send_t48_reminder",
          type: "action",
          label: "Send T-48 reminder",
          config: smsAction(
            "Reminder: your appointment is coming up in 48 hours. Reply if you need to reschedule or have questions."
          ),
          nextIds: ["delay_24_hours_before"],
        },
        {
          id: "delay_24_hours_before",
          type: "delay",
          label: "Wait until T-24",
          config: delayConfig(24, "hours", {
            relativeTo: "event_start",
            direction: "before",
          }),
          nextIds: ["action_send_t24_reminder"],
        },
        {
          id: "action_send_t24_reminder",
          type: "action",
          label: "Send T-24 reminder",
          config: emailAction(
            "Appointment reminder for tomorrow",
            "<p>Your appointment is scheduled for tomorrow. Reply if you need to update the time or if there is anything we should know before we meet.</p>"
          ),
          nextIds: ["condition_no_show"],
        },
        {
          id: "condition_no_show",
          type: "condition",
          label: "Marked no-show?",
          config: conditionConfig("field_matches", {
            fieldKey: "status",
            matchValue: "no_show",
          }),
          nextIds: ["action_no_show_recovery", "stop_attended"],
        },
        {
          id: "action_no_show_recovery",
          type: "action",
          label: "Send no-show recovery outreach",
          config: smsAction(
            "We missed you today. Reply here and we can help reschedule or follow up on anything you need."
          ),
          nextIds: ["stop_recovery_started"],
        },
        {
          id: "stop_attended",
          type: "stop",
          label: "Exit: appointment attended",
          nextIds: [],
        },
        {
          id: "stop_recovery_started",
          type: "stop",
          label: "Exit: recovery started",
          nextIds: [],
        },
      ],
    },
  },
  {
    key: "new_member_30_day",
    name: "New Member 30-Day",
    description:
      "Guide brand-new members through a 30-day welcome journey with milestone check-ins and pastoral escalation.",
    category: "Follow-Up",
    triggerEvent: "contacts.member.created.v1",
    mode: "template",
    recommendedChannels: ["sms", "email"],
    definition: {
      version: 1,
      startNodeId: "trigger_new_member_created",
      nodes: [
        {
          id: "trigger_new_member_created",
          type: "trigger",
          label: "New member created",
          nextIds: ["action_send_day0_welcome"],
        },
        {
          id: "action_send_day0_welcome",
          type: "action",
          label: "Send day 0 welcome",
          config: smsAction(
            "Welcome to the church family. We are glad you are here and look forward to helping you get connected."
          ),
          nextIds: ["delay_day3"],
        },
        {
          id: "delay_day3",
          type: "delay",
          label: "Wait 3 days",
          config: delayConfig(3, "days", {
            relativeTo: "workflow_start",
          }),
          nextIds: ["action_send_day3_next_steps"],
        },
        {
          id: "action_send_day3_next_steps",
          type: "action",
          label: "Send next-steps guide",
          config: emailAction(
            "Your next steps at church",
            "<p>Here are a few simple ways to get connected: join a group, serve on a team, or connect with a pastor.</p>"
          ),
          nextIds: ["delay_day10"],
        },
        {
          id: "delay_day10",
          type: "delay",
          label: "Wait until day 10",
          config: delayConfig(10, "days", {
            relativeTo: "workflow_start",
          }),
          nextIds: ["action_send_day10_group_invite"],
        },
        {
          id: "action_send_day10_group_invite",
          type: "action",
          label: "Send groups or serving invite",
          config: smsAction(
            "We would love to help you find a group or serving opportunity that fits you. Reply anytime and we will connect you."
          ),
          nextIds: ["delay_day20"],
        },
        {
          id: "delay_day20",
          type: "delay",
          label: "Wait until day 20",
          config: delayConfig(20, "days", {
            relativeTo: "workflow_start",
          }),
          nextIds: ["condition_engaged_check"],
        },
        {
          id: "condition_engaged_check",
          type: "condition",
          label: "Member engaged?",
          config: conditionConfig("engaged", {
            matchValue: "member_engaged",
            lookbackDays: 20,
          }),
          nextIds: ["stop_member_engaged", "action_create_pastoral_checkin_task"],
        },
        {
          id: "action_create_pastoral_checkin_task",
          type: "action",
          label: "Create pastoral check-in task",
          config: taskAction(
            "30-day member check-in needed",
            "The new member sequence did not detect engagement by day 20. Follow up personally and log the result."
          ),
          nextIds: ["delay_day30"],
        },
        {
          id: "delay_day30",
          type: "delay",
          label: "Wait until day 30",
          config: delayConfig(30, "days", {
            relativeTo: "workflow_start",
          }),
          nextIds: ["action_send_day30_pathway"],
        },
        {
          id: "action_send_day30_pathway",
          type: "action",
          label: "Send day 30 membership pathway recap",
          config: emailAction(
            "A quick recap of your next steps",
            "<p>We are glad you are part of the church family. Here is a quick recap of ways to stay connected and keep growing.</p>"
          ),
          nextIds: ["stop_sequence_complete"],
        },
        {
          id: "stop_member_engaged",
          type: "stop",
          label: "Exit: member engaged",
          nextIds: [],
        },
        {
          id: "stop_sequence_complete",
          type: "stop",
          label: "Exit: 30-day sequence complete",
          nextIds: [],
        },
      ],
    },
  },
  {
    key: "volunteer_onboarding",
    name: "Volunteer Onboarding",
    description:
      "Onboard new volunteers with role expectations, training reminders, and escalation when acknowledgment is missing.",
    category: "Service Ops",
    triggerEvent: "volunteers.created.v1",
    mode: "template",
    recommendedChannels: ["sms", "email"],
    definition: {
      version: 1,
      startNodeId: "trigger_volunteer_created",
      nodes: [
        {
          id: "trigger_volunteer_created",
          type: "trigger",
          label: "Volunteer record created",
          nextIds: ["action_send_role_packet"],
        },
        {
          id: "action_send_role_packet",
          type: "action",
          label: "Send role packet and expectations",
          config: emailAction(
            "Welcome to the volunteer team",
            "<p>Thanks for serving. Attached here is a simple overview of your role, what to expect, and who to contact if you have questions.</p>"
          ),
          nextIds: ["delay_24_hours"],
        },
        {
          id: "delay_24_hours",
          type: "delay",
          label: "Wait 24 hours",
          config: delayConfig(24, "hours", {
            relativeTo: "workflow_start",
          }),
          nextIds: ["condition_ack_received"],
        },
        {
          id: "condition_ack_received",
          type: "condition",
          label: "Acknowledged onboarding?",
          config: conditionConfig("field_matches", {
            fieldKey: "onboardingAcknowledged",
            matchValue: "true",
            lookbackHours: 24,
          }),
          nextIds: ["stop_onboarding_acknowledged", "action_send_training_reminder"],
        },
        {
          id: "action_send_training_reminder",
          type: "action",
          label: "Send training reminder",
          config: smsAction(
            "Friendly reminder to review your volunteer onboarding steps when you have a chance. Reply if you need help."
          ),
          nextIds: ["delay_72_hours"],
        },
        {
          id: "delay_72_hours",
          type: "delay",
          label: "Wait 72 hours",
          config: delayConfig(72, "hours", {
            relativeTo: "workflow_start",
          }),
          nextIds: ["action_create_volunteer_followup_task"],
        },
        {
          id: "action_create_volunteer_followup_task",
          type: "action",
          label: "Create volunteer follow-up task",
          config: taskAction(
            "Volunteer onboarding follow-up",
            "The volunteer onboarding sequence has not been acknowledged. Reach out to confirm the team member is ready to serve."
          ),
          nextIds: ["stop_escalated_to_leader"],
        },
        {
          id: "stop_onboarding_acknowledged",
          type: "stop",
          label: "Exit: onboarding acknowledged",
          nextIds: [],
        },
        {
          id: "stop_escalated_to_leader",
          type: "stop",
          label: "Exit: escalated to ministry leader",
          nextIds: [],
        },
      ],
    },
  },
  {
    key: "inactive_member_reengagement",
    name: "Inactive Member Re-Engagement",
    description:
      "Re-engage inactive members with two timed touches and create a care follow-up task when inactivity persists.",
    category: "Follow-Up",
    triggerEvent: "contacts.reengagement.requested.v1",
    mode: "template",
    recommendedChannels: ["sms", "email"],
    definition: {
      version: 1,
      startNodeId: "trigger_reengagement_requested",
      nodes: [
        {
          id: "trigger_reengagement_requested",
          type: "trigger",
          label: "Inactive member flagged",
          nextIds: ["action_send_reengagement_touch_1"],
        },
        {
          id: "action_send_reengagement_touch_1",
          type: "action",
          label: "Send first re-engagement touch",
          config: smsAction(
            "We have not seen you in a while and would love to reconnect. Reply if there is a way we can support you."
          ),
          nextIds: ["delay_72_hours"],
        },
        {
          id: "delay_72_hours",
          type: "delay",
          label: "Wait 72 hours",
          config: delayConfig(72, "hours", {
            relativeTo: "workflow_start",
          }),
          nextIds: ["condition_replied_after_touch_1"],
        },
        {
          id: "condition_replied_after_touch_1",
          type: "condition",
          label: "Replied after first touch?",
          config: conditionConfig("contact_replied", {
            matchValue: "reply_received",
            lookbackHours: 72,
          }),
          nextIds: ["stop_reengaged", "action_send_reengagement_touch_2"],
        },
        {
          id: "action_send_reengagement_touch_2",
          type: "action",
          label: "Send second re-engagement touch",
          config: emailAction(
            "We would love to reconnect",
            "<p>Hi {{ contact.firstName | default: 'there' }},</p><p>We wanted to reach out again and see how you are doing. If there is anything we can pray about or help with, reply here.</p>"
          ),
          nextIds: ["delay_7_days"],
        },
        {
          id: "delay_7_days",
          type: "delay",
          label: "Wait 7 days",
          config: delayConfig(7, "days", {
            relativeTo: "workflow_start",
          }),
          nextIds: ["condition_still_inactive"],
        },
        {
          id: "condition_still_inactive",
          type: "condition",
          label: "Still inactive?",
          config: conditionConfig("field_matches", {
            fieldKey: "memberStatus",
            matchValue: "inactive",
            lookbackDays: 7,
          }),
          nextIds: ["action_create_care_task", "stop_reengaged"],
        },
        {
          id: "action_create_care_task",
          type: "action",
          label: "Create pastoral care task",
          config: taskAction(
            "Inactive member follow-up",
            "The re-engagement sequence did not produce a response. Reach out personally and record any updates."
          ),
          nextIds: ["stop_escalated"],
        },
        {
          id: "stop_reengaged",
          type: "stop",
          label: "Exit: member re-engaged",
          nextIds: [],
        },
        {
          id: "stop_escalated",
          type: "stop",
          label: "Exit: escalated to care team",
          nextIds: [],
        },
      ],
    },
  },
  {
    key: "event_rsvp_reminders",
    name: "Event RSVP and Reminder",
    description:
      "Confirm event RSVPs and run layered reminders to improve attendance and reduce day-of no-shows.",
    category: "Appointments",
    triggerEvent: "events.rsvp.created.v1",
    mode: "template",
    recommendedChannels: ["sms", "email"],
    definition: {
      version: 1,
      startNodeId: "trigger_event_rsvp_created",
      nodes: [
        {
          id: "trigger_event_rsvp_created",
          type: "trigger",
          label: "Event RSVP created",
          nextIds: ["action_send_rsvp_confirmation"],
        },
        {
          id: "action_send_rsvp_confirmation",
          type: "action",
          label: "Send RSVP confirmation",
          config: smsAction(
            "Thanks for RSVPing. We are looking forward to seeing you and will send a reminder before the event."
          ),
          nextIds: ["delay_72_hours_before_event"],
        },
        {
          id: "delay_72_hours_before_event",
          type: "delay",
          label: "Wait until 72 hours before event",
          config: delayConfig(72, "hours", {
            relativeTo: "event_start",
            direction: "before",
          }),
          nextIds: ["action_send_72_hour_reminder"],
        },
        {
          id: "action_send_72_hour_reminder",
          type: "action",
          label: "Send 72-hour reminder",
          config: emailAction(
            "Your event reminder",
            "<p>Your event is coming up soon. We are looking forward to seeing you and wanted to make sure you have the latest details.</p>"
          ),
          nextIds: ["delay_24_hours_before_event"],
        },
        {
          id: "delay_24_hours_before_event",
          type: "delay",
          label: "Wait until 24 hours before event",
          config: delayConfig(24, "hours", {
            relativeTo: "event_start",
            direction: "before",
          }),
          nextIds: ["condition_attendance_confirmed"],
        },
        {
          id: "condition_attendance_confirmed",
          type: "condition",
          label: "Attendance confirmed?",
          config: conditionConfig("field_matches", {
            fieldKey: "attendanceStatus",
            matchValue: "confirmed",
          }),
          nextIds: ["action_send_day_of_details", "action_send_reconfirm_prompt"],
        },
        {
          id: "action_send_day_of_details",
          type: "action",
          label: "Send day-of details",
          config: smsAction(
            "Today is the day. Here are the event details and anything you need to know before arriving."
          ),
          nextIds: ["stop_event_prepared"],
        },
        {
          id: "action_send_reconfirm_prompt",
          type: "action",
          label: "Send reconfirmation prompt",
          config: smsAction(
            "Just checking in before the event. Reply yes if you are still planning to attend."
          ),
          nextIds: ["stop_reconfirm_sent"],
        },
        {
          id: "stop_event_prepared",
          type: "stop",
          label: "Exit: attendee prepared",
          nextIds: [],
        },
        {
          id: "stop_reconfirm_sent",
          type: "stop",
          label: "Exit: reconfirmation sent",
          nextIds: [],
        },
      ],
    },
  },
];

function cloneDefinition(definition: AutomationDefinition): AutomationDefinition {
  return JSON.parse(JSON.stringify(definition));
}

export function getAutomationTemplateCatalog() {
  return TEMPLATE_CATALOG.map((template) => ({
    ...template,
    definition: cloneDefinition(template.definition),
  }));
}

export function getAutomationTemplateByKey(templateKey: string) {
  const template = TEMPLATE_CATALOG.find((row) => row.key === templateKey);
  if (!template) return null;
  return {
    ...template,
    definition: cloneDefinition(template.definition),
  };
}
