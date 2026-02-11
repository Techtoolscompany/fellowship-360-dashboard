import type { GraceIntent, ProposedAction, SlotState } from "../types";

export function planActions(intent: GraceIntent, state: SlotState): ProposedAction[] {
  if (intent === "prayer_request" && state.requestText) {
    return [
      {
        id: crypto.randomUUID(),
        tool: "prayerRequests.create",
        reason: "Create prayer request from user input",
        requiresApproval: false,
        input: {
          content: state.requestText,
          urgency: state.urgency ?? "normal",
          contactName: state.name,
        },
      },
    ];
  }

  if (intent === "appointment_request" && state.preferredTime) {
    return [
      {
        id: crypto.randomUUID(),
        tool: "appointments.book",
        reason: "Book requested pastoral appointment",
        requiresApproval: true,
        input: {
          title: state.appointmentTitle ?? "Pastoral Appointment",
          dateTime: state.preferredTime,
          notes: state.requestText,
        },
      },
    ];
  }

  if (intent === "info_request") {
    return [
      {
        id: crypto.randomUUID(),
        tool: "churchInfo.search",
        reason: "Find church information",
        requiresApproval: false,
        input: {
          query: state.requestText,
        },
      },
    ];
  }

  if (intent === "emergency") {
    return [
      {
        id: crypto.randomUUID(),
        tool: "handoff.transfer",
        reason: "Emergency or high-risk content requires escalation",
        requiresApproval: false,
        input: {
          reason: "emergency_detected",
        },
      },
    ];
  }

  return [];
}
