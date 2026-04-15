"use client";

import { useEffect, useState } from "react";
import { AutomationGuidedBuilder } from "./AutomationGuidedBuilder";
import { AutomationOutlineEditor } from "./AutomationOutlineEditor";
import { AutomationPolicyForm } from "./AutomationPolicyForm";
import { AutomationValidationSummary } from "./AutomationValidationSummary";
import type {
  AutomationCompliancePolicy,
  AutomationDefinition,
} from "@/lib/automations/types";

type BroadcastOption = {
  id: string;
  title: string;
};

type AutomationWorkflowEditorProps = {
  editorId?: string | null;
  name: string;
  description: string;
  triggerEvent: string;
  definition: AutomationDefinition;
  validationErrors: string[];
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onTriggerEventChange: (value: string) => void;
  onDefinitionChange: (value: AutomationDefinition) => void;
  policy?: AutomationCompliancePolicy;
  onPolicyChange?: (value: AutomationCompliancePolicy) => void;
  broadcastOptions?: BroadcastOption[];
};

export function AutomationWorkflowEditor({
  editorId,
  name,
  description,
  triggerEvent,
  definition,
  validationErrors,
  onNameChange,
  onDescriptionChange,
  onTriggerEventChange,
  onDefinitionChange,
  policy,
  onPolicyChange,
  broadcastOptions = [],
}: AutomationWorkflowEditorProps) {
  const [showAdvancedEditor, setShowAdvancedEditor] = useState(false);
  const [showPolicyControls, setShowPolicyControls] = useState(false);

  useEffect(() => {
    setShowAdvancedEditor(false);
    setShowPolicyControls(false);
  }, [editorId]);

  return (
    <div className="space-y-4">
      <AutomationGuidedBuilder
        editorId={editorId}
        name={name}
        description={description}
        triggerEvent={triggerEvent}
        definition={definition}
        onNameChange={onNameChange}
        onDescriptionChange={onDescriptionChange}
        onTriggerEventChange={onTriggerEventChange}
        onDefinitionChange={onDefinitionChange}
      />

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Advanced Controls</p>
            <p className="mt-1 text-xs text-slate-500">
              Open these only when you need exact step ordering, branch edits, or policy tuning.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {policy && onPolicyChange ? (
              <button
                type="button"
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                onClick={() => setShowPolicyControls((value) => !value)}
              >
                {showPolicyControls ? "Hide policy controls" : "Show policy controls"}
              </button>
            ) : null}
            <button
              type="button"
              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              onClick={() => setShowAdvancedEditor((value) => !value)}
            >
              {showAdvancedEditor ? "Hide detailed editor" : "Show detailed editor"}
            </button>
          </div>
        </div>

        {showPolicyControls && policy && onPolicyChange ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <AutomationPolicyForm value={policy} onChange={onPolicyChange} />
          </div>
        ) : null}

        {showAdvancedEditor ? (
          <AutomationOutlineEditor
            definition={definition}
            triggerEvent={triggerEvent}
            onDefinitionChange={onDefinitionChange}
            onTriggerEventChange={onTriggerEventChange}
            broadcastOptions={broadcastOptions}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            The detailed editor is hidden right now. Use it when you need to fine tune step copy,
            delays, exact condition branches, or task details beyond the guided builder.
          </div>
        )}

        <AutomationValidationSummary errors={validationErrors} />
      </div>
    </div>
  );
}
