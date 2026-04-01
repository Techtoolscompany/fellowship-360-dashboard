CREATE TYPE "public"."automation_mode" AS ENUM('template', 'builder');
--> statement-breakpoint

CREATE TYPE "public"."automation_status" AS ENUM('draft', 'published', 'paused', 'archived');
--> statement-breakpoint

CREATE TYPE "public"."automation_run_status" AS ENUM('entered', 'running', 'failed', 'completed', 'exited');
--> statement-breakpoint

CREATE TABLE "automation_workflow" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "mode" "automation_mode" DEFAULT 'template' NOT NULL,
  "status" "automation_status" DEFAULT 'draft' NOT NULL,
  "template_key" text,
  "trigger_event" text,
  "definition_json" jsonb DEFAULT '{"version":1,"nodes":[]}'::jsonb NOT NULL,
  "validation_errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "quiet_hours_enabled" boolean DEFAULT true NOT NULL,
  "quiet_hours_start" text DEFAULT '21:00' NOT NULL,
  "quiet_hours_end" text DEFAULT '08:00' NOT NULL,
  "daily_send_cap" integer DEFAULT 250 NOT NULL,
  "respect_opt_out" boolean DEFAULT true NOT NULL,
  "created_by_user_id" text,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL,
  "published_at" timestamp,
  "last_validated_at" timestamp
);
--> statement-breakpoint

CREATE TABLE "automation_workflow_run" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "workflow_id" text NOT NULL,
  "contact_id" text,
  "status" "automation_run_status" DEFAULT 'entered' NOT NULL,
  "current_node_id" text,
  "current_node_type" text,
  "last_error" text,
  "metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "entered_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL,
  "completed_at" timestamp,
  "exited_at" timestamp
);
--> statement-breakpoint

ALTER TABLE "automation_workflow"
  ADD CONSTRAINT "automation_workflow_organization_id_organization_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "automation_workflow"
  ADD CONSTRAINT "automation_workflow_created_by_user_id_app_user_id_fk"
  FOREIGN KEY ("created_by_user_id") REFERENCES "public"."app_user"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "automation_workflow_run"
  ADD CONSTRAINT "automation_workflow_run_organization_id_organization_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "automation_workflow_run"
  ADD CONSTRAINT "automation_workflow_run_workflow_id_automation_workflow_id_fk"
  FOREIGN KEY ("workflow_id") REFERENCES "public"."automation_workflow"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "automation_workflow_run"
  ADD CONSTRAINT "automation_workflow_run_contact_id_church_contact_id_fk"
  FOREIGN KEY ("contact_id") REFERENCES "public"."church_contact"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

CREATE INDEX "automation_workflow_org_status_idx"
  ON "automation_workflow" USING btree ("organization_id", "status");
--> statement-breakpoint

CREATE INDEX "automation_workflow_org_mode_idx"
  ON "automation_workflow" USING btree ("organization_id", "mode");
--> statement-breakpoint

CREATE INDEX "automation_workflow_org_created_idx"
  ON "automation_workflow" USING btree ("organization_id", "created_at");
--> statement-breakpoint

CREATE UNIQUE INDEX "automation_workflow_org_template_mode_uidx"
  ON "automation_workflow" USING btree ("organization_id", "template_key", "mode");
--> statement-breakpoint

CREATE INDEX "automation_workflow_run_workflow_status_idx"
  ON "automation_workflow_run" USING btree ("workflow_id", "status");
--> statement-breakpoint

CREATE INDEX "automation_workflow_run_org_contact_idx"
  ON "automation_workflow_run" USING btree ("organization_id", "contact_id");
--> statement-breakpoint

CREATE INDEX "automation_workflow_run_org_entered_idx"
  ON "automation_workflow_run" USING btree ("organization_id", "entered_at");
