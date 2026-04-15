ALTER TABLE "grace_goal"
  ADD COLUMN "workflow_key" text DEFAULT 'legacy_goal' NOT NULL;
--> statement-breakpoint

ALTER TABLE "grace_goal"
  ADD COLUMN "workflow_version" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint

ALTER TABLE "grace_goal"
  ADD COLUMN "trigger_source" text DEFAULT 'legacy' NOT NULL;
--> statement-breakpoint

ALTER TABLE "grace_goal"
  ADD COLUMN "trigger_channel" text DEFAULT 'in_app' NOT NULL;
--> statement-breakpoint

ALTER TABLE "grace_goal"
  ADD COLUMN "subject_contact_id" text;
--> statement-breakpoint

ALTER TABLE "grace_goal"
  ADD COLUMN "subject_entity_type" text;
--> statement-breakpoint

ALTER TABLE "grace_goal"
  ADD COLUMN "subject_entity_id" text;
--> statement-breakpoint

ALTER TABLE "grace_goal"
  ADD COLUMN "correlation_key" text;
--> statement-breakpoint

ALTER TABLE "grace_goal"
  ADD COLUMN "policy_mode" text DEFAULT 'confirm_once' NOT NULL;
--> statement-breakpoint

ALTER TABLE "grace_goal"
  ADD COLUMN "last_decision_summary" text;
--> statement-breakpoint

ALTER TABLE "grace_goal"
  ADD COLUMN "next_checkpoint_at" timestamp;
--> statement-breakpoint

UPDATE "grace_goal"
SET
  "workflow_key" = CASE
    WHEN "goal_type" = 'service_staffing' THEN 'volunteer_staffing'
    WHEN "goal_type" = 'communications_followup' THEN 'guest_followup'
    WHEN "goal_type" = 'operations' THEN 'prayer_care'
    ELSE 'legacy_goal'
  END,
  "trigger_channel" = COALESCE(NULLIF("source_channel", ''), 'in_app'),
  "next_checkpoint_at" = "next_run_at"
WHERE "workflow_key" = 'legacy_goal';
--> statement-breakpoint

ALTER TABLE "grace_goal"
  ADD CONSTRAINT "grace_goal_subject_contact_id_church_contact_id_fk"
  FOREIGN KEY ("subject_contact_id") REFERENCES "public"."church_contact"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

CREATE INDEX "grace_goal_org_workflow_status_idx"
  ON "grace_goal" USING btree ("organization_id", "workflow_key", "status");
--> statement-breakpoint

CREATE INDEX "grace_goal_org_workflow_subject_idx"
  ON "grace_goal" USING btree (
    "organization_id",
    "workflow_key",
    "subject_entity_type",
    "subject_entity_id"
  );
--> statement-breakpoint

CREATE INDEX "grace_goal_org_correlation_idx"
  ON "grace_goal" USING btree ("organization_id", "correlation_key");
