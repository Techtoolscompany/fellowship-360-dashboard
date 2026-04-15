"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AUTOMATION_TRIGGER_PRESETS,
  type AutomationDefinition,
} from "@/lib/automations/types";
import {
  AUTOMATION_DELAY_UNITS,
  type AutomationDelayUnit,
} from "@/lib/automations/editor";
import {
  DEFAULT_GUIDED_WORKFLOW_DRAFT,
  GUIDED_WORKFLOW_GOALS,
  applyGraceNotesToGuidedDraft,
  buildGuidedAutomationDefinition,
  getSuggestedWorkflowDescription,
  getSuggestedWorkflowName,
  inferGuidedDraftFromWorkflow,
  summarizeGuidedDraft,
  type GuidedWorkflowAction,
  type GuidedWorkflowDraft,
  type GuidedWorkflowGoal,
} from "@/lib/automations/guided-builder";

type AutomationGuidedBuilderProps = {
  editorId?: string | null;
  name: string;
  description: string;
  triggerEvent: string;
  definition: AutomationDefinition;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onTriggerEventChange: (value: string) => void;
  onDefinitionChange: (value: AutomationDefinition) => void;
};

const STEP_TITLES = [
  "What should Grace build?",
  "What starts the workflow?",
  "What should Grace do first?",
  "How long should Grace wait?",
  "What should Grace do next?",
  "Should Grace hand this off to a person?",
] as const;

const GOAL_LABELS: Record<GuidedWorkflowGoal, { label: string; helper: string }> = {
  welcome: {
    label: "Welcome",
    helper: "A first-touch sequence for new visitors, members, or volunteers.",
  },
  follow_up: {
    label: "Follow-up",
    helper: "A short outreach flow to keep the conversation moving.",
  },
  reminder: {
    label: "Reminder",
    helper: "A timing-based sequence for appointments or events.",
  },
  care: {
    label: "Care",
    helper: "A pastoral support flow with room for a human handoff.",
  },
  reengage: {
    label: "Re-engage",
    helper: "A gentle sequence to reconnect with people who have gone quiet.",
  },
};

const ACTION_LABELS: Record<GuidedWorkflowAction, { label: string; helper: string }> = {
  send_sms: {
    label: "Send a text",
    helper: "Use SMS as the first or next touch.",
  },
  send_email: {
    label: "Send an email",
    helper: "Use email when you need more room or a softer follow-up.",
  },
  create_task: {
    label: "Create a task",
    helper: "Hand the next step to a staff member instead of sending another message.",
  },
  stop: {
    label: "Stop the flow",
    helper: "End the sequence without another automated step.",
  },
};

const NOTE_SUGGESTIONS = [
  "New visitors get a text right away, wait 2 days, then send an email if they do not reply.",
  "Appointment reminders should email first, wait 1 day, then create a staff task if there is no response.",
  "New members get a welcome text and a personal follow-up task after 3 days.",
] as const;

function StepPill({
  index,
  label,
  active,
  complete,
  onClick,
}: {
  index: number;
  label: string;
  active: boolean;
  complete: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-left transition ${
        active
          ? "bg-[#bbff00] text-[#111827]"
          : complete
            ? "bg-slate-900 text-white"
            : "bg-white text-slate-500 hover:bg-slate-100"
      }`}
    >
      <span className="block text-[10px] font-semibold uppercase tracking-[0.18em]">
        Step {index + 1}
      </span>
      <span className="mt-0.5 block text-xs font-semibold">{label}</span>
    </button>
  );
}

function ChoiceCard({
  active,
  label,
  helper,
  onClick,
}: {
  active: boolean;
  label: string;
  helper: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-4 py-4 text-left transition ${
        active
          ? "border-[#bbff00] bg-[#bbff00]/15 text-slate-950 shadow-[0_0_0_1px_rgba(187,255,0,0.5)]"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
      }`}
    >
      <p className="text-sm font-semibold">{label}</p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </button>
  );
}

function inputClassName() {
  return "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#bbff00]";
}

export function AutomationGuidedBuilder({
  editorId,
  name,
  description,
  triggerEvent,
  definition,
  onNameChange,
  onDescriptionChange,
  onTriggerEventChange,
  onDefinitionChange,
}: AutomationGuidedBuilderProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [draft, setDraft] = useState<GuidedWorkflowDraft>(() =>
    inferGuidedDraftFromWorkflow({ triggerEvent, definition })
  );

  useEffect(() => {
    setDraft(inferGuidedDraftFromWorkflow({ triggerEvent, definition }));
    setCurrentStep(0);
  }, [editorId]);

  const suggestedName = useMemo(
    () => getSuggestedWorkflowName(draft.goal, triggerEvent || "contacts.created.v1"),
    [draft.goal, triggerEvent]
  );

  const suggestedDescription = useMemo(
    () => getSuggestedWorkflowDescription(draft.goal, triggerEvent || "contacts.created.v1"),
    [draft.goal, triggerEvent]
  );

  const summaryLines = useMemo(
    () => summarizeGuidedDraft(triggerEvent, draft),
    [draft, triggerEvent]
  );

  const progressPercent = Math.round(((currentStep + 1) / STEP_TITLES.length) * 100);

  const applyDraft = () => {
    if (!name.trim()) {
      onNameChange(suggestedName);
    }
    if (!description.trim()) {
      onDescriptionChange(suggestedDescription);
    }

    onDefinitionChange(
      buildGuidedAutomationDefinition({
        triggerEvent: triggerEvent || "contacts.created.v1",
        draft,
      })
    );
  };

  const applyGraceDraft = () => {
    const suggestion = applyGraceNotesToGuidedDraft(draft.graceNotes, draft);
    setDraft(suggestion.draft);
    if (suggestion.triggerEvent) {
      onTriggerEventChange(suggestion.triggerEvent);
    }
    if (!name.trim() && suggestion.suggestedName) {
      onNameChange(suggestion.suggestedName);
    }
    if (!description.trim() && suggestion.suggestedDescription) {
      onDescriptionChange(suggestion.suggestedDescription);
    }
  };

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(187,255,0,0.25),transparent_32%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white">
              Grace Builder
            </div>
            <h3 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">
              Build the workflow by answering a few questions.
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              This drafts the workflow for you first. The detailed step editor stays below if you
              want to fine tune the exact sequence later.
            </p>
          </div>
          <div className="min-w-[180px] rounded-3xl border border-white/80 bg-white/80 p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Progress
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-950">{progressPercent}%</p>
            <div className="mt-3 h-2 rounded-full bg-slate-200">
              <div
                className="h-2 rounded-full bg-[#bbff00] transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {STEP_TITLES.map((label, index) => (
            <StepPill
              key={label}
              index={index}
              label={label}
              active={currentStep === index}
              complete={currentStep > index}
              onClick={() => setCurrentStep(index)}
            />
          ))}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="rounded-3xl bg-slate-950 px-5 py-4 text-white">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
              Grace asks
            </p>
            <p className="mt-2 text-2xl font-semibold">{STEP_TITLES[currentStep]}</p>
          </div>

          <div className="mt-5 space-y-5">
            {currentStep === 0 ? (
              <>
                <label className="block space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Workflow name
                  </span>
                  <input
                    className={inputClassName()}
                    value={name}
                    onChange={(event) => onNameChange(event.target.value)}
                    placeholder={suggestedName}
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    What kind of journey is this?
                  </span>
                  <div className="grid gap-3 md:grid-cols-2">
                    {GUIDED_WORKFLOW_GOALS.map((goal) => (
                      <ChoiceCard
                        key={goal}
                        active={draft.goal === goal}
                        label={GOAL_LABELS[goal].label}
                        helper={GOAL_LABELS[goal].helper}
                        onClick={() => setDraft((current) => ({ ...current, goal }))}
                      />
                    ))}
                  </div>
                </label>
                <label className="block space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Description
                  </span>
                  <textarea
                    className={`${inputClassName()} min-h-[112px]`}
                    value={description}
                    onChange={(event) => onDescriptionChange(event.target.value)}
                    placeholder={suggestedDescription}
                  />
                </label>
              </>
            ) : null}

            {currentStep === 1 ? (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  {AUTOMATION_TRIGGER_PRESETS.map((preset) => (
                    <ChoiceCard
                      key={preset.value}
                      active={triggerEvent === preset.value}
                      label={preset.label}
                      helper={preset.description}
                      onClick={() => onTriggerEventChange(preset.value)}
                    />
                  ))}
                </div>
                <label className="block space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Or use your own event key
                  </span>
                  <input
                    className={inputClassName()}
                    value={triggerEvent}
                    onChange={(event) => onTriggerEventChange(event.target.value)}
                    placeholder="contacts.created.v1"
                  />
                </label>
              </>
            ) : null}

            {currentStep === 2 ? (
              <>
                <div className="grid gap-3 md:grid-cols-3">
                  {(["send_sms", "send_email", "create_task"] as const).map((action) => (
                    <ChoiceCard
                      key={action}
                      active={draft.firstAction === action}
                      label={ACTION_LABELS[action].label}
                      helper={ACTION_LABELS[action].helper}
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          firstAction: action,
                        }))
                      }
                    />
                  ))}
                </div>

                {draft.firstAction === "create_task" ? (
                  <>
                    <label className="block space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Task title
                      </span>
                      <input
                        className={inputClassName()}
                        value={draft.taskTitle}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            taskTitle: event.target.value,
                          }))
                        }
                        placeholder="Follow up personally"
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Task instructions
                      </span>
                      <textarea
                        className={`${inputClassName()} min-h-[140px]`}
                        value={draft.firstMessage}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            firstMessage: event.target.value,
                          }))
                        }
                        placeholder="Tell the team member what they should do first."
                      />
                    </label>
                  </>
                ) : (
                  <label className="block space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      First message
                    </span>
                    <textarea
                      className={`${inputClassName()} min-h-[160px]`}
                      value={draft.firstMessage}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          firstMessage: event.target.value,
                        }))
                      }
                      placeholder={
                        draft.firstAction === "send_email"
                          ? "Write the first email Grace should send."
                          : "Write the first text Grace should send."
                      }
                    />
                  </label>
                )}
              </>
            ) : null}

            {currentStep === 3 ? (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  <ChoiceCard
                    active={draft.delayEnabled}
                    label="Yes, wait before the next step"
                    helper="Add a delay before Grace checks back in."
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        delayEnabled: true,
                      }))
                    }
                  />
                  <ChoiceCard
                    active={!draft.delayEnabled}
                    label="No, move immediately"
                    helper="Skip the delay and move straight to the next step."
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        delayEnabled: false,
                      }))
                    }
                  />
                </div>

                {draft.delayEnabled ? (
                  <div className="grid gap-3 md:grid-cols-[140px_1fr]">
                    <label className="block space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Amount
                      </span>
                      <input
                        className={inputClassName()}
                        type="number"
                        min={1}
                        value={draft.delayAmount}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            delayAmount: Math.max(1, Number(event.target.value || 1)),
                          }))
                        }
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Unit
                      </span>
                      <select
                        className={inputClassName()}
                        value={draft.delayUnit}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            delayUnit: event.target.value as AutomationDelayUnit,
                          }))
                        }
                      >
                        {AUTOMATION_DELAY_UNITS.map((unit) => (
                          <option key={unit} value={unit}>
                            {unit}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ) : null}
              </>
            ) : null}

            {currentStep === 4 ? (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  {(["send_sms", "send_email", "create_task", "stop"] as const).map((action) => (
                    <ChoiceCard
                      key={action}
                      active={draft.secondAction === action}
                      label={ACTION_LABELS[action].label}
                      helper={ACTION_LABELS[action].helper}
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          secondAction: action,
                        }))
                      }
                    />
                  ))}
                </div>

                {draft.secondAction !== "stop" ? (
                  draft.secondAction === "create_task" ? (
                    <label className="block space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Task instructions
                      </span>
                      <textarea
                        className={`${inputClassName()} min-h-[140px]`}
                        value={draft.secondMessage}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            secondMessage: event.target.value,
                          }))
                        }
                        placeholder="Tell the team member what the follow-up task should accomplish."
                      />
                    </label>
                  ) : (
                    <label className="block space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Follow-up message
                      </span>
                      <textarea
                        className={`${inputClassName()} min-h-[160px]`}
                        value={draft.secondMessage}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            secondMessage: event.target.value,
                          }))
                        }
                        placeholder={
                          draft.secondAction === "send_email"
                            ? "Write the follow-up email Grace should send."
                            : "Write the follow-up text Grace should send."
                        }
                      />
                    </label>
                  )
                ) : null}
              </>
            ) : null}

            {currentStep === 5 ? (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  <ChoiceCard
                    active={draft.addTaskOnNoResponse}
                    label="Yes, create a staff task"
                    helper="Grace will add a manual task if the flow still needs a person."
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        addTaskOnNoResponse: true,
                      }))
                    }
                  />
                  <ChoiceCard
                    active={!draft.addTaskOnNoResponse}
                    label="No, keep it fully automated"
                    helper="The journey will end without a human handoff."
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        addTaskOnNoResponse: false,
                      }))
                    }
                  />
                </div>

                {draft.addTaskOnNoResponse ? (
                  <div className="grid gap-3">
                    <label className="block space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Task title
                      </span>
                      <input
                        className={inputClassName()}
                        value={draft.taskTitle}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            taskTitle: event.target.value,
                          }))
                        }
                        placeholder="Manual follow-up needed"
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Task instructions
                      </span>
                      <textarea
                        className={`${inputClassName()} min-h-[120px]`}
                        value={draft.taskInstructions}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            taskInstructions: event.target.value,
                          }))
                        }
                        placeholder="Tell the team member what to do if Grace cannot finish the sequence alone."
                      />
                    </label>
                  </div>
                ) : null}

                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Tell Grace in plain English</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Grace will use this note to prefill the questions above. This is a guided
                        shortcut, not the final saved prompt.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                      onClick={applyGraceDraft}
                    >
                      Let Grace draft it
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {NOTE_SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:border-slate-300"
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            graceNotes: suggestion,
                          }))
                        }
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>

                  <textarea
                    className={`${inputClassName()} mt-3 min-h-[140px]`}
                    value={draft.graceNotes}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        graceNotes: event.target.value,
                      }))
                    }
                    placeholder="Example: New visitors get a text right away, wait 2 days, then send an email if they do not reply."
                  />
                </div>
              </>
            ) : null}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              onClick={() => setCurrentStep((step) => Math.max(0, step - 1))}
              disabled={currentStep === 0}
            >
              Back
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                onClick={applyDraft}
              >
                Build journey draft
              </button>
              <button
                type="button"
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                onClick={() =>
                  setCurrentStep((step) => Math.min(STEP_TITLES.length - 1, step + 1))
                }
                disabled={currentStep === STEP_TITLES.length - 1}
              >
                Next
              </button>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Draft Summary
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-950">
              {name.trim() || suggestedName}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {description.trim() || suggestedDescription}
            </p>
            <div className="mt-4 space-y-2">
              {summaryLines.map((line) => (
                <div key={line} className="rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {line}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
              Grace Tips
            </p>
            <div className="mt-3 space-y-3 text-sm text-white/80">
              <p>Start with the outcome you want, not the steps.</p>
              <p>Choose the trigger first, then the first touch, then the wait.</p>
              <p>Use the advanced editor below only when you need exact branch tuning.</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
