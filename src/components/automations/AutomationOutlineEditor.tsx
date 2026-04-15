"use client";

import { useMemo, type ReactNode } from "react";
import {
  AUTOMATION_ACTION_TYPES,
  AUTOMATION_CONDITION_TYPES,
  AUTOMATION_DELAY_UNITS,
  createOutlineStep,
  definitionToOutline,
  describeAutomationStep,
  duplicateOutlineStep,
  getActionType,
  getConditionType,
  getDelayAmount,
  getDelayUnit,
  outlineToDefinition,
  replaceOutlineStepKind,
  type AutomationOutline,
  type AutomationOutlineStep,
  type AutomationOutlineStepKind,
} from "@/lib/automations/editor";
import {
  AUTOMATION_TRIGGER_PRESETS,
  type AutomationDefinition,
} from "@/lib/automations/types";

type BroadcastOption = {
  id: string;
  title: string;
};

type BranchPathSegment = {
  stepIndex: number;
  branch: "then" | "else";
};

type StepCollectionPath = BranchPathSegment[];

type AutomationOutlineEditorProps = {
  definition: AutomationDefinition;
  triggerEvent: string;
  onDefinitionChange: (definition: AutomationDefinition) => void;
  onTriggerEventChange: (value: string) => void;
  broadcastOptions?: BroadcastOption[];
};

function patchStepCollections(
  steps: AutomationOutlineStep[],
  path: StepCollectionPath,
  updater: (items: AutomationOutlineStep[]) => AutomationOutlineStep[]
): AutomationOutlineStep[] {
  if (path.length === 0) {
    return updater(steps);
  }

  const [current, ...rest] = path;

  return steps.map((step, index) => {
    if (index !== current.stepIndex || step.kind !== "condition") {
      return step;
    }

    if (current.branch === "then") {
      return {
        ...step,
        thenSteps: patchStepCollections(step.thenSteps ?? [], rest, updater),
      };
    }

    return {
      ...step,
      elseSteps: patchStepCollections(step.elseSteps ?? [], rest, updater),
    };
  });
}

function withPatchedOutline(
  outline: AutomationOutline,
  path: StepCollectionPath,
  updater: (items: AutomationOutlineStep[]) => AutomationOutlineStep[]
): AutomationOutline {
  return {
    ...outline,
    steps: patchStepCollections(outline.steps, path, updater),
  };
}

function actionOptions(includeBroadcast: boolean) {
  return AUTOMATION_ACTION_TYPES.filter(
    (type) => includeBroadcast || type !== "broadcast_send"
  );
}

function stepKindOptions(includeBroadcast: boolean): AutomationOutlineStepKind[] {
  void includeBroadcast;
  return ["action", "delay", "condition", "stop"];
}

function AddStepStrip({
  onAdd,
  includeBroadcast,
}: {
  onAdd: (step: AutomationOutlineStep) => void;
  includeBroadcast: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3">
      <button
        type="button"
        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-white"
        onClick={() =>
          onAdd(
            createOutlineStep("action", {
              config: { actionType: "send_sms" },
              label: "Send SMS",
            })
          )
        }
      >
        + Send SMS
      </button>
      <button
        type="button"
        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-white"
        onClick={() =>
          onAdd(
            createOutlineStep("action", {
              config: { actionType: "send_email" },
              label: "Send email",
            })
          )
        }
      >
        + Send email
      </button>
      <button
        type="button"
        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-white"
        onClick={() => onAdd(createOutlineStep("delay"))}
      >
        + Wait
      </button>
      <button
        type="button"
        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-white"
        onClick={() => onAdd(createOutlineStep("condition"))}
      >
        + Condition
      </button>
      <button
        type="button"
        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-white"
        onClick={() =>
          onAdd(
            createOutlineStep("action", {
              config: { actionType: "create_task" },
              label: "Create task",
            })
          )
        }
      >
        + Task
      </button>
      {includeBroadcast ? (
        <button
          type="button"
          className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-white"
          onClick={() =>
            onAdd(
              createOutlineStep("action", {
                config: { actionType: "broadcast_send" },
                label: "Send broadcast",
              })
            )
          }
        >
          + Broadcast
        </button>
      ) : null}
      <button
        type="button"
        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-white"
        onClick={() => onAdd(createOutlineStep("stop"))}
      >
        + Stop
      </button>
    </div>
  );
}

export function AutomationOutlineEditor({
  definition,
  triggerEvent,
  onDefinitionChange,
  onTriggerEventChange,
  broadcastOptions = [],
}: AutomationOutlineEditorProps) {
  const outline = useMemo(() => definitionToOutline(definition), [definition]);
  const selectedTriggerPreset = useMemo(
    () =>
      AUTOMATION_TRIGGER_PRESETS.find((preset) => preset.value === triggerEvent) ?? null,
    [triggerEvent]
  );
  const includeBroadcast =
    broadcastOptions.length > 0 ||
    definition.nodes.some(
      (node) =>
        node.type === "action" &&
        String((node.config as Record<string, unknown> | undefined)?.actionType ?? "") ===
          "broadcast_send"
    );

  const commit = (nextOutline: AutomationOutline) => {
    onDefinitionChange(outlineToDefinition(nextOutline));
  };

  const updateCollection = (
    path: StepCollectionPath,
    updater: (items: AutomationOutlineStep[]) => AutomationOutlineStep[]
  ) => {
    commit(withPatchedOutline(outline, path, updater));
  };

  const renderStepList = (
    steps: AutomationOutlineStep[],
    path: StepCollectionPath,
    branchLabel?: string
  ): ReactNode => {
    return (
      <div className="space-y-3">
        {branchLabel ? (
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {branchLabel}
          </div>
        ) : null}

        {steps.length === 0 ? (
          <AddStepStrip
            includeBroadcast={includeBroadcast}
            onAdd={(step) => updateCollection(path, () => [step])}
          />
        ) : null}

        {steps.map((step, index) => {
          const stepPath = path;
          const moveDisabledUp = index === 0;
          const moveDisabledDown = index === steps.length - 1;
          const actionType = getActionType(step);

          const patchStep = (updater: (current: AutomationOutlineStep) => AutomationOutlineStep) =>
            updateCollection(stepPath, (items) =>
              items.map((item, itemIndex) =>
                itemIndex === index ? updater(item) : item
              )
            );

          return (
            <article key={step.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase text-slate-700">
                      {step.kind}
                    </span>
                    <span className="text-xs font-semibold text-slate-600">
                      Step {index + 1}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {step.label || describeAutomationStep(step)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {describeAutomationStep(step)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-md border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:text-slate-300"
                    disabled={moveDisabledUp}
                    onClick={() =>
                      updateCollection(stepPath, (items) => {
                        const next = [...items];
                        const previous = next[index - 1];
                        next[index - 1] = next[index]!;
                        next[index] = previous!;
                        return next;
                      })
                    }
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:text-slate-300"
                    disabled={moveDisabledDown}
                    onClick={() =>
                      updateCollection(stepPath, (items) => {
                        const next = [...items];
                        const following = next[index + 1];
                        next[index + 1] = next[index]!;
                        next[index] = following!;
                        return next;
                      })
                    }
                  >
                    Down
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                    onClick={() =>
                      updateCollection(stepPath, (items) => {
                        const next = [...items];
                        next.splice(index + 1, 0, duplicateOutlineStep(step));
                        return next;
                      })
                    }
                  >
                    Duplicate
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-red-200 px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50"
                    onClick={() =>
                      updateCollection(stepPath, (items) =>
                        items.filter((_, itemIndex) => itemIndex !== index)
                      )
                    }
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <label className="space-y-1 text-xs text-slate-600">
                  Step type
                  <select
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    value={step.kind}
                    onChange={(event) =>
                      patchStep((current) =>
                        replaceOutlineStepKind(
                          current,
                          event.target.value as AutomationOutlineStepKind
                        )
                      )
                    }
                  >
                    {stepKindOptions(includeBroadcast).map((kind) => (
                      <option key={kind} value={kind}>
                        {kind.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 text-xs text-slate-600 md:col-span-2">
                  Label
                  <input
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    value={step.label}
                    onChange={(event) =>
                      patchStep((current) => ({
                        ...current,
                        label: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>

              <label className="mt-3 block space-y-1 text-xs text-slate-600">
                Description
                <input
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  value={step.description ?? ""}
                  onChange={(event) =>
                    patchStep((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                />
              </label>

              {step.kind === "action" ? (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label className="space-y-1 text-xs text-slate-600">
                    Action type
                    <select
                      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                      value={actionType}
                      onChange={(event) =>
                        patchStep((current) => ({
                          ...current,
                          config: {
                            ...(current.config ?? {}),
                            actionType: event.target.value,
                          },
                        }))
                      }
                    >
                      {actionOptions(includeBroadcast).map((option) => (
                        <option key={option} value={option}>
                          {option.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </label>

                  {actionType === "broadcast_send" ? (
                    <label className="space-y-1 text-xs text-slate-600">
                      Broadcast
                      <select
                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                        value={String(step.config?.broadcastId ?? "")}
                        onChange={(event) =>
                          patchStep((current) => ({
                            ...current,
                            config: {
                              ...(current.config ?? {}),
                              broadcastId: event.target.value || null,
                            },
                          }))
                        }
                      >
                        <option value="">Select broadcast...</option>
                        {broadcastOptions.map((broadcast) => (
                          <option key={broadcast.id} value={broadcast.id}>
                            {broadcast.title}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  {actionType === "send_sms" ? (
                    <label className="space-y-1 text-xs text-slate-600 md:col-span-2">
                      SMS copy
                      <textarea
                        className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
                        rows={3}
                        value={String(step.config?.messageText ?? "")}
                        onChange={(event) =>
                          patchStep((current) => ({
                            ...current,
                            config: {
                              ...(current.config ?? {}),
                              messageText: event.target.value,
                            },
                          }))
                        }
                        placeholder="Hi {{first_name}}, thanks for visiting..."
                      />
                    </label>
                  ) : null}

                  {actionType === "send_email" ? (
                    <>
                      <label className="space-y-1 text-xs text-slate-600">
                        Subject
                        <input
                          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                          value={String(step.config?.emailSubject ?? "")}
                          onChange={(event) =>
                            patchStep((current) => ({
                              ...current,
                              config: {
                                ...(current.config ?? {}),
                                emailSubject: event.target.value,
                              },
                            }))
                          }
                        />
                      </label>
                      <label className="space-y-1 text-xs text-slate-600 md:col-span-2">
                        Email body
                        <textarea
                          className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
                          rows={4}
                          value={String(step.config?.emailBody ?? "")}
                          onChange={(event) =>
                            patchStep((current) => ({
                              ...current,
                              config: {
                                ...(current.config ?? {}),
                                emailBody: event.target.value,
                              },
                            }))
                          }
                        />
                      </label>
                    </>
                  ) : null}

                  {actionType === "create_task" ? (
                    <>
                      <label className="space-y-1 text-xs text-slate-600">
                        Task title
                        <input
                          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                          value={String(step.config?.taskTitle ?? "")}
                          onChange={(event) =>
                            patchStep((current) => ({
                              ...current,
                              config: {
                                ...(current.config ?? {}),
                                taskTitle: event.target.value,
                              },
                            }))
                          }
                        />
                      </label>
                      <label className="space-y-1 text-xs text-slate-600 md:col-span-2">
                        Task instructions
                        <textarea
                          className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
                          rows={3}
                          value={String(step.config?.taskInstructions ?? "")}
                          onChange={(event) =>
                            patchStep((current) => ({
                              ...current,
                              config: {
                                ...(current.config ?? {}),
                                taskInstructions: event.target.value,
                              },
                            }))
                          }
                        />
                      </label>
                    </>
                  ) : null}
                </div>
              ) : null}

              {step.kind === "delay" ? (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label className="space-y-1 text-xs text-slate-600">
                    Amount
                    <input
                      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                      type="number"
                      min={1}
                      value={getDelayAmount(step)}
                      onChange={(event) =>
                        patchStep((current) => ({
                          ...current,
                          config: {
                            ...(current.config ?? {}),
                            amount: Number(event.target.value || 1),
                          },
                        }))
                      }
                    />
                  </label>

                  <label className="space-y-1 text-xs text-slate-600">
                    Unit
                    <select
                      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                      value={getDelayUnit(step)}
                      onChange={(event) =>
                        patchStep((current) => ({
                          ...current,
                          config: {
                            ...(current.config ?? {}),
                            unit: event.target.value,
                          },
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

              {step.kind === "condition" ? (
                <div className="mt-4 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1 text-xs text-slate-600">
                      Condition type
                      <select
                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                        value={getConditionType(step)}
                        onChange={(event) =>
                          patchStep((current) => ({
                            ...current,
                            config: {
                              ...(current.config ?? {}),
                              conditionType: event.target.value,
                            },
                          }))
                        }
                      >
                        {AUTOMATION_CONDITION_TYPES.map((option) => (
                          <option key={option} value={option}>
                            {option.replaceAll("_", " ")}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-1 text-xs text-slate-600">
                      Match detail
                      <input
                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                        value={String(step.config?.matchValue ?? "")}
                        onChange={(event) =>
                          patchStep((current) => ({
                            ...current,
                            config: {
                              ...(current.config ?? {}),
                              matchValue: event.target.value,
                            },
                          }))
                        }
                        placeholder="Optional comparison value"
                      />
                    </label>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-3 rounded-lg border border-emerald-200 bg-white p-3">
                      {renderStepList(
                        step.thenSteps ?? [],
                        [...path, { stepIndex: index, branch: "then" }],
                        "If yes"
                      )}
                    </div>
                    <div className="space-y-3 rounded-lg border border-amber-200 bg-white p-3">
                      {renderStepList(
                        step.elseSteps ?? [],
                        [...path, { stepIndex: index, branch: "else" }],
                        "If no"
                      )}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mt-3">
                <AddStepStrip
                  includeBroadcast={includeBroadcast}
                  onAdd={(newStep) =>
                    updateCollection(stepPath, (items) => {
                      const next = [...items];
                      next.splice(index + 1, 0, newStep);
                      return next;
                    })
                  }
                />
              </div>
            </article>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)_minmax(0,240px)]">
        <label className="space-y-1 text-xs text-slate-600">
          Common trigger
          <select
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={selectedTriggerPreset?.value ?? ""}
            onChange={(event) => onTriggerEventChange(event.target.value)}
          >
            <option value="">Choose a trigger preset...</option>
            {AUTOMATION_TRIGGER_PRESETS.map((preset) => (
              <option key={preset.value} value={preset.value}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs text-slate-600">
          Trigger event key
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={triggerEvent}
            onChange={(event) => onTriggerEventChange(event.target.value)}
            placeholder="contacts.created.v1"
          />
        </label>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
          <p className="font-semibold text-slate-700">
            {selectedTriggerPreset?.label ?? "Custom trigger"}
          </p>
          <p className="mt-1">
            {selectedTriggerPreset?.description ??
              "Use a stable event key from your app or Inngest events. The journey below runs in order with waits and explicit yes/no branches."}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Journey Outline</h3>
            <p className="mt-1 text-xs text-slate-500">
              Add steps in order. Conditions split into explicit yes/no branches.
            </p>
          </div>
        </div>

        {renderStepList(outline.steps, [])}
      </div>
    </div>
  );
}
