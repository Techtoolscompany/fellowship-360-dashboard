CREATE TYPE "public"."automation_dead_letter_status" AS ENUM('pending', 'replayed', 'discarded');
--> statement-breakpoint

CREATE TABLE "automation_dead_letter" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "workflow_id" text NOT NULL,
  "run_id" text,
  "contact_id" text,
  "trigger_event" text,
  "source" text DEFAULT 'event_trigger' NOT NULL,
  "status" "automation_dead_letter_status" DEFAULT 'pending' NOT NULL,
  "attempt_count" integer DEFAULT 1 NOT NULL,
  "last_error" text NOT NULL,
  "payload_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "first_failed_at" timestamp NOT NULL,
  "last_failed_at" timestamp NOT NULL,
  "next_retry_at" timestamp NOT NULL,
  "resolved_at" timestamp,
  "resolution_note" text,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);
--> statement-breakpoint

ALTER TABLE "automation_dead_letter"
  ADD CONSTRAINT "automation_dead_letter_organization_id_organization_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "automation_dead_letter"
  ADD CONSTRAINT "automation_dead_letter_workflow_id_automation_workflow_id_fk"
  FOREIGN KEY ("workflow_id") REFERENCES "public"."automation_workflow"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "automation_dead_letter"
  ADD CONSTRAINT "automation_dead_letter_run_id_automation_workflow_run_id_fk"
  FOREIGN KEY ("run_id") REFERENCES "public"."automation_workflow_run"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "automation_dead_letter"
  ADD CONSTRAINT "automation_dead_letter_contact_id_church_contact_id_fk"
  FOREIGN KEY ("contact_id") REFERENCES "public"."church_contact"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

CREATE INDEX "automation_dead_letter_workflow_status_idx"
  ON "automation_dead_letter" USING btree ("workflow_id", "status");
--> statement-breakpoint

CREATE INDEX "automation_dead_letter_org_status_retry_idx"
  ON "automation_dead_letter" USING btree ("organization_id", "status", "next_retry_at");
--> statement-breakpoint

CREATE UNIQUE INDEX "automation_dead_letter_run_uidx"
  ON "automation_dead_letter" USING btree ("run_id");
