import {
  AUTOMATION_DELAY_UNITS,
  createOutlineStep,
  definitionToOutline,
  getActionType,
  getDelayAmount,
  getDelayUnit,
  outlineToDefinition,
  type AutomationActionType,
  type AutomationDelayUnit,
  type AutomationOutlineStep,
} from "./editor";
import {
  AUTOMATION_TRIGGER_PRESETS,
  type AutomationDefinition,
} from "./types";

export const GUIDED_WORKFLOW_GOALS = [
  "welcome",
  "follow_up",
  "reminder",
  "care",
  "reengage",
] as const;

export type GuidedWorkflowGoal = (typeof GUIDED_WORKFLOW_GOALS)[number];

export const GUIDED_WORKFLOW_ACTIONS = [
  "send_sms",
  "send_email",
  "create_task",
  "stop",
] as const;

export type GuidedWorkflowAction = (typeof GUIDED_WORKFLOW_ACTIONS)[number];

export type GuidedWorkflowDraft = {
  goal: GuidedWorkflowGoal;
  firstAction: Exclude<GuidedWorkflowAction, "stop">;
  firstMessage: string;
  delayEnabled: boolean;
  delayAmount: number;
  delayUnit: AutomationDelayUnit;
  secondAction: GuidedWorkflowAction;
  secondMessage: string;
  addTaskOnNoResponse: boolean;
  taskTitle: string;
  taskInstructions: string;
  graceNotes: string;
};

export const DEFAULT_GUIDED_WORKFLOW_DRAFT: GuidedWorkflowDraft = {
  goal: "follow_up",
  firstAction: "send_sms",
  firstMessage: "",
  delayEnabled: true,
  delayAmount: 2,
  delayUnit: "days",
  secondAction: "send_email",
  secondMessage: "",
  addTaskOnNoResponse: true,
  taskTitle: "Manual follow-up needed",
  taskInstructions: "Reach out personally if there has been no response.",
  graceNotes: "",
};

type InferGuidedDraftInput = {
  triggerEvent: string;
  definition: AutomationDefinition;
};

type GraceDraftSuggestion = {
  draft: GuidedWorkflowDraft;
  triggerEvent?: string;
  suggestedName?: string;
  suggestedDescription?: string;
};

function messageLikeAction(action: GuidedWorkflowAction | AutomationActionType) {
  return action === "send_sms" || action === "send_email";
}

function normalizeDelayUnitValue(value: string): AutomationDelayUnit {
  return AUTOMATION_DELAY_UNITS.includes(value as AutomationDelayUnit)
    ? (value as AutomationDelayUnit)
    : "days";
}

function getSuggestedTriggerGoal(triggerEvent: string): GuidedWorkflowGoal {
  if (triggerEvent === "appointments.scheduled.v1") return "reminder";
  if (triggerEvent === "grace.prayer-request.followup.requested.v1") return "care";
  if (triggerEvent === "contacts.member.created.v1") return "welcome";
  if (triggerEvent === "volunteers.created.v1") return "welcome";
  return "follow_up";
}

function buildAudienceLabel(triggerEvent: string) {
  if (triggerEvent === "contacts.member.created.v1") return "member";
  if (triggerEvent === "appointments.scheduled.v1") return "appointment";
  if (triggerEvent === "volunteers.created.v1") return "volunteer";
  if (
    triggerEvent === "contacts.created.v1" ||
    triggerEvent === "grace.guest.first-time-appointment.requested.v1"
  ) {
    return "visitor";
  }
  return "contact";
}

export function getSuggestedWorkflowName(goal: GuidedWorkflowGoal, triggerEvent: string) {
  const audience = buildAudienceLabel(triggerEvent);

  if (goal === "welcome") {
    return `${audience[0]?.toUpperCase() ?? "C"}${audience.slice(1)} Welcome`;
  }
  if (goal === "reminder") {
    return `${audience[0]?.toUpperCase() ?? "A"}${audience.slice(1)} Reminder`;
  }
  if (goal === "care") {
    return `${audience[0]?.toUpperCase() ?? "C"}${audience.slice(1)} Care Follow-Up`;
  }
  if (goal === "reengage") {
    return `${audience[0]?.toUpperCase() ?? "C"}${audience.slice(1)} Re-Engagement`;
  }
  return `${audience[0]?.toUpperCase() ?? "C"}${audience.slice(1)} Follow-Up`;
}

export function getSuggestedWorkflowDescription(goal: GuidedWorkflowGoal, triggerEvent: string) {
  const audience = buildAudienceLabel(triggerEvent);

  if (goal === "welcome") {
    return `Welcome new ${audience}s with an immediate first touch and a clear follow-up path.`;
  }
  if (goal === "reminder") {
    return `Keep ${audience}s informed with reminders, follow-up, and manual handoff if needed.`;
  }
  if (goal === "care") {
    return `Coordinate pastoral care for ${audience}s with timely outreach and staff follow-up.`;
  }
  if (goal === "reengage") {
    return `Reconnect with ${audience}s who need a second touch and a personal follow-up option.`;
  }
  return `Guide ${audience}s through a short outreach sequence with built-in follow-up.`;
}

function buildActionStep(
  action: Exclude<GuidedWorkflowAction, "stop">,
  message: string,
  options?: {
    label?: string;
    fallbackTaskTitle?: string;
    fallbackTaskInstructions?: string;
  }
): AutomationOutlineStep {
  if (action === "send_sms") {
    return createOutlineStep("action", {
      label: options?.label ?? "Send text",
      config: {
        actionType: "send_sms",
        messageText: message,
      },
    });
  }

  if (action === "send_email") {
    return createOutlineStep("action", {
      label: options?.label ?? "Send email",
      config: {
        actionType: "send_email",
        emailSubject: "Following up with you",
        emailBody: message,
      },
    });
  }

  return createOutlineStep("action", {
    label: options?.label ?? "Create task",
    config: {
      actionType: "create_task",
      taskTitle: options?.fallbackTaskTitle ?? "Follow up personally",
      taskInstructions: message || options?.fallbackTaskInstructions || "Reach out personally.",
    },
  });
}

function buildTaskStep(title: string, instructions: string) {
  return createOutlineStep("action", {
    label: "Create manual follow-up task",
    config: {
      actionType: "create_task",
      taskTitle: title || "Manual follow-up needed",
      taskInstructions: instructions || "Reach out personally.",
    },
  });
}

function firstActionMessage(step: AutomationOutlineStep | undefined) {
  if (!step || step.kind !== "action") return "";
  const actionType = getActionType(step);

  if (actionType === "send_sms") {
    return String(step.config?.messageText ?? "");
  }
  if (actionType === "send_email") {
    return String(step.config?.emailBody ?? "");
  }
  if (actionType === "create_task") {
    return String(step.config?.taskInstructions ?? "");
  }
  return "";
}

export function inferGuidedDraftFromWorkflow(
  input: InferGuidedDraftInput
): GuidedWorkflowDraft {
  const outline = definitionToOutline(input.definition);
  const steps = outline.steps;
  const firstActionStep = steps.find((step) => step.kind === "action");
  const delayStep = steps.find((step) => step.kind === "delay");
  const conditionStep = steps.find((step) => step.kind === "condition");

  const firstAction =
    firstActionStep?.kind === "action"
      ? (getActionType(firstActionStep) as Exclude<GuidedWorkflowAction, "stop">)
      : DEFAULT_GUIDED_WORKFLOW_DRAFT.firstAction;

  const elseBranchAction =
    conditionStep?.kind === "condition"
      ? conditionStep.elseSteps?.find(
          (step) => step.kind === "action" && getActionType(step) !== "create_task"
        )
      : undefined;

  const elseBranchTask =
    conditionStep?.kind === "condition"
      ? conditionStep.elseSteps?.find(
          (step) => step.kind === "action" && getActionType(step) === "create_task"
        )
      : undefined;

  return {
    goal: getSuggestedTriggerGoal(input.triggerEvent),
    firstAction,
    firstMessage: firstActionMessage(firstActionStep),
    delayEnabled: Boolean(delayStep),
    delayAmount: delayStep ? getDelayAmount(delayStep) : DEFAULT_GUIDED_WORKFLOW_DRAFT.delayAmount,
    delayUnit: delayStep ? getDelayUnit(delayStep) : DEFAULT_GUIDED_WORKFLOW_DRAFT.delayUnit,
    secondAction:
      elseBranchAction?.kind === "action"
        ? (getActionType(elseBranchAction) as GuidedWorkflowAction)
        : "stop",
    secondMessage: firstActionMessage(elseBranchAction),
    addTaskOnNoResponse: Boolean(elseBranchTask),
    taskTitle: String(elseBranchTask?.config?.taskTitle ?? DEFAULT_GUIDED_WORKFLOW_DRAFT.taskTitle),
    taskInstructions: String(
      elseBranchTask?.config?.taskInstructions ??
        DEFAULT_GUIDED_WORKFLOW_DRAFT.taskInstructions
    ),
    graceNotes: "",
  };
}

export function buildGuidedAutomationDefinition(params: {
  triggerEvent: string;
  draft: GuidedWorkflowDraft;
}): AutomationDefinition {
  const triggerLabel =
    AUTOMATION_TRIGGER_PRESETS.find((preset) => preset.value === params.triggerEvent)?.label ??
    "Trigger";

  const steps: AutomationOutlineStep[] = [];
  steps.push(
    buildActionStep(params.draft.firstAction, params.draft.firstMessage, {
      label:
        params.draft.firstAction === "create_task"
          ? "Create kickoff task"
          : params.draft.firstAction === "send_email"
            ? "Send first email"
            : "Send first text",
      fallbackTaskTitle: params.draft.taskTitle,
      fallbackTaskInstructions: params.draft.taskInstructions,
    })
  );

  if (params.draft.delayEnabled) {
    steps.push(
      createOutlineStep("delay", {
        label: `Wait ${params.draft.delayAmount} ${params.draft.delayUnit}`,
        config: {
          amount: params.draft.delayAmount,
          unit: params.draft.delayUnit,
        },
      })
    );
  }

  const needsConditionalBranch =
    messageLikeAction(params.draft.firstAction) &&
    (params.draft.secondAction !== "stop" || params.draft.addTaskOnNoResponse);

  if (needsConditionalBranch) {
    const elseSteps: AutomationOutlineStep[] = [];

    if (params.draft.secondAction !== "stop") {
      elseSteps.push(
        buildActionStep(
          params.draft.secondAction as Exclude<GuidedWorkflowAction, "stop">,
          params.draft.secondMessage,
          {
            label:
              params.draft.secondAction === "create_task"
                ? "Create follow-up task"
                : params.draft.secondAction === "send_email"
                  ? "Send follow-up email"
                  : "Send follow-up text",
            fallbackTaskTitle: params.draft.taskTitle,
            fallbackTaskInstructions: params.draft.taskInstructions,
          }
        )
      );
    }

    if (params.draft.addTaskOnNoResponse) {
      elseSteps.push(buildTaskStep(params.draft.taskTitle, params.draft.taskInstructions));
    }

    elseSteps.push(createOutlineStep("stop", { label: "Stop" }));

    steps.push(
      createOutlineStep("condition", {
        label:
          params.draft.firstAction === "send_email"
            ? "Did they engage with the email?"
            : "Did they reply?",
        config: {
          conditionType:
            params.draft.firstAction === "send_email" ? "email_opened" : "contact_replied",
        },
        thenSteps: [createOutlineStep("stop", { label: "Stop: engaged" })],
        elseSteps,
      })
    );
  } else {
    if (params.draft.secondAction !== "stop") {
      steps.push(
        buildActionStep(
          params.draft.secondAction as Exclude<GuidedWorkflowAction, "stop">,
          params.draft.secondMessage,
          {
            label:
              params.draft.secondAction === "create_task"
                ? "Create follow-up task"
                : params.draft.secondAction === "send_email"
                  ? "Send follow-up email"
                  : "Send follow-up text",
            fallbackTaskTitle: params.draft.taskTitle,
            fallbackTaskInstructions: params.draft.taskInstructions,
          }
        )
      );
    }

    if (params.draft.addTaskOnNoResponse) {
      steps.push(buildTaskStep(params.draft.taskTitle, params.draft.taskInstructions));
    }

    steps.push(createOutlineStep("stop", { label: "Stop" }));
  }

  return outlineToDefinition({
    triggerNodeId: "trigger_manual",
    triggerLabel,
    steps,
  });
}

export function summarizeGuidedDraft(triggerEvent: string, draft: GuidedWorkflowDraft) {
  const triggerLabel =
    AUTOMATION_TRIGGER_PRESETS.find((preset) => preset.value === triggerEvent)?.label ??
    (triggerEvent.trim() ? triggerEvent : "No trigger selected");
  const lines = [
    `Starts when ${triggerLabel.toLowerCase()}.`,
    `Grace ${draft.firstAction === "send_email" ? "sends an email" : draft.firstAction === "create_task" ? "creates a task" : "sends a text"} first.`,
  ];

  if (draft.delayEnabled) {
    lines.push(`Grace waits ${draft.delayAmount} ${draft.delayUnit} before the next check.`);
  }

  if (draft.secondAction === "stop" && !draft.addTaskOnNoResponse) {
    lines.push("The journey stops after the first touch.");
  } else {
    lines.push(
      draft.secondAction === "stop"
        ? "Grace stops the sequence if there is no automated follow-up."
        : `If there is no response, Grace ${
            draft.secondAction === "send_email"
              ? "sends a follow-up email"
              : draft.secondAction === "create_task"
                ? "creates a follow-up task"
                : "sends a follow-up text"
          }.`
    );
  }

  if (draft.addTaskOnNoResponse) {
    lines.push("A manual task is added for staff if the automation still needs a human handoff.");
  }

  return lines;
}

export function applyGraceNotesToGuidedDraft(
  notes: string,
  currentDraft: GuidedWorkflowDraft
): GraceDraftSuggestion {
  const normalized = notes.trim().toLowerCase();
  const nextDraft: GuidedWorkflowDraft = {
    ...currentDraft,
    graceNotes: notes,
  };

  let nextTriggerEvent: string | undefined;

  if (!normalized) {
    return { draft: nextDraft };
  }

  if (normalized.includes("appointment")) {
    nextTriggerEvent = "appointments.scheduled.v1";
    nextDraft.goal = "reminder";
  } else if (normalized.includes("volunteer")) {
    nextTriggerEvent = "volunteers.created.v1";
    nextDraft.goal = "welcome";
  } else if (normalized.includes("member")) {
    nextTriggerEvent = "contacts.member.created.v1";
    nextDraft.goal = normalized.includes("re-engage") || normalized.includes("reengage")
      ? "reengage"
      : "welcome";
  } else if (
    normalized.includes("visitor") ||
    normalized.includes("guest") ||
    normalized.includes("new contact")
  ) {
    nextTriggerEvent = "contacts.created.v1";
    nextDraft.goal = "welcome";
  }

  if (normalized.includes("email first")) {
    nextDraft.firstAction = "send_email";
  } else if (normalized.includes("task first")) {
    nextDraft.firstAction = "create_task";
  } else if (normalized.includes("text") || normalized.includes("sms")) {
    nextDraft.firstAction = "send_sms";
  }

  const delayMatch = normalized.match(/(\d+)\s*(minute|hour|day|week)s?/);
  if (delayMatch?.[1] && delayMatch[2]) {
    nextDraft.delayEnabled = true;
    nextDraft.delayAmount = Math.max(1, Number(delayMatch[1]));
    nextDraft.delayUnit = normalizeDelayUnitValue(`${delayMatch[2]}s`);
  }

  if (
    normalized.includes("then email") ||
    normalized.includes("follow up with email") ||
    normalized.includes("send an email if")
  ) {
    nextDraft.secondAction = "send_email";
  } else if (
    normalized.includes("then text") ||
    normalized.includes("then sms") ||
    normalized.includes("follow up with text")
  ) {
    nextDraft.secondAction = "send_sms";
  } else if (normalized.includes("then task") || normalized.includes("assign a task")) {
    nextDraft.secondAction = "create_task";
  } else if (normalized.includes("just stop") || normalized.includes("then stop")) {
    nextDraft.secondAction = "stop";
  }

  if (
    normalized.includes("create task") ||
    normalized.includes("manual follow-up") ||
    normalized.includes("pastor should follow up") ||
    normalized.includes("someone should call")
  ) {
    nextDraft.addTaskOnNoResponse = true;
  }

  if (!nextDraft.firstMessage) {
    nextDraft.firstMessage =
      nextDraft.firstAction === "send_email"
        ? "Hi there, we wanted to follow up and make sure you have what you need."
        : nextDraft.firstAction === "create_task"
          ? "Reach out personally and continue the conversation."
          : "Hi there, just checking in and making sure you have what you need.";
  }

  if (!nextDraft.secondMessage && nextDraft.secondAction !== "stop") {
    nextDraft.secondMessage =
      nextDraft.secondAction === "send_email"
        ? "Just following up again. Reply here if you would like someone from the team to help."
        : nextDraft.secondAction === "create_task"
          ? "Assign a personal follow-up so someone can reach out directly."
          : "Checking in again. Reply here if you would like to connect.";
  }

  const triggerEvent = nextTriggerEvent ?? "";

  return {
    draft: nextDraft,
    triggerEvent: nextTriggerEvent,
    suggestedName: getSuggestedWorkflowName(nextDraft.goal, triggerEvent || "contacts.created.v1"),
    suggestedDescription: getSuggestedWorkflowDescription(
      nextDraft.goal,
      triggerEvent || "contacts.created.v1"
    ),
  };
}
