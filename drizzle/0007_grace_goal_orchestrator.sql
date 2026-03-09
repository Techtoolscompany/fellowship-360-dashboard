CREATE TYPE "public"."grace_goal_type" AS ENUM(
  'service_staffing',
  'communications_followup',
  'operations',
  'custom'
);
--> statement-breakpoint

CREATE TYPE "public"."grace_goal_status" AS ENUM(
  'queued',
  'in_progress',
  'waiting',
  'completed',
  'failed',
  'cancelled',
  'escalated'
);
--> statement-breakpoint

CREATE TYPE "public"."grace_goal_step_status" AS ENUM(
  'pending',
  'in_progress',
  'waiting',
  'completed',
  'failed',
  'skipped'
);
--> statement-breakpoint

CREATE TABLE "grace_goal" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "goal_type" "grace_goal_type" DEFAULT 'custom' NOT NULL,
  "status" "grace_goal_status" DEFAULT 'queued' NOT NULL,
  "source_channel" text DEFAULT 'in_app' NOT NULL,
  "objective_text" text NOT NULL,
  "service_run_id" text,
  "requested_by_user_id" text,
  "context_json" jsonb,
  "result_json" jsonb,
  "error_text" text,
  "started_at" timestamp,
  "completed_at" timestamp,
  "next_run_at" timestamp,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);
--> statement-breakpoint

ALTER TABLE "grace_goal"
  ADD CONSTRAINT "grace_goal_organization_id_organization_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "grace_goal"
  ADD CONSTRAINT "grace_goal_service_run_id_service_run_id_fk"
  FOREIGN KEY ("service_run_id") REFERENCES "public"."service_run"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "grace_goal"
  ADD CONSTRAINT "grace_goal_requested_by_user_id_app_user_id_fk"
  FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."app_user"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

CREATE INDEX "grace_goal_org_status_idx"
  ON "grace_goal" USING btree ("organization_id", "status");
--> statement-breakpoint

CREATE INDEX "grace_goal_org_type_idx"
  ON "grace_goal" USING btree ("organization_id", "goal_type");
--> statement-breakpoint

CREATE INDEX "grace_goal_run_status_idx"
  ON "grace_goal" USING btree ("service_run_id", "status");
--> statement-breakpoint

CREATE TABLE "grace_goal_step" (
  "id" text PRIMARY KEY NOT NULL,
  "goal_id" text NOT NULL,
  "organization_id" text NOT NULL,
  "step_key" text NOT NULL,
  "title" text NOT NULL,
  "status" "grace_goal_step_status" DEFAULT 'pending' NOT NULL,
  "run_order" integer DEFAULT 0 NOT NULL,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "input_json" jsonb,
  "output_json" jsonb,
  "error_text" text,
  "started_at" timestamp,
  "completed_at" timestamp,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);
--> statement-breakpoint

ALTER TABLE "grace_goal_step"
  ADD CONSTRAINT "grace_goal_step_goal_id_grace_goal_id_fk"
  FOREIGN KEY ("goal_id") REFERENCES "public"."grace_goal"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "grace_goal_step"
  ADD CONSTRAINT "grace_goal_step_organization_id_organization_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

CREATE INDEX "grace_goal_step_goal_order_idx"
  ON "grace_goal_step" USING btree ("goal_id", "run_order");
--> statement-breakpoint

CREATE INDEX "grace_goal_step_org_status_idx"
  ON "grace_goal_step" USING btree ("organization_id", "status");
--> statement-breakpoint

CREATE INDEX "grace_goal_step_goal_key_idx"
  ON "grace_goal_step" USING btree ("goal_id", "step_key");
