CREATE TYPE "public"."grace_audit_event_type" AS ENUM('ai_decision', 'action_execution', 'workflow_execution');
--> statement-breakpoint

CREATE TYPE "public"."grace_audit_source" AS ENUM('grace_router', 'grace_executor', 'automation_runtime');
--> statement-breakpoint

CREATE TYPE "public"."grace_audit_status" AS ENUM('success', 'error', 'queued', 'blocked', 'skipped');
--> statement-breakpoint

CREATE TABLE "grace_audit_stream" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "session_id" text,
  "workflow_id" text,
  "workflow_run_id" text,
  "event_type" "grace_audit_event_type" NOT NULL,
  "source" "grace_audit_source" NOT NULL,
  "status" "grace_audit_status" NOT NULL,
  "actor_type" "grace_actor_type" DEFAULT 'system' NOT NULL,
  "channel" "grace_channel",
  "intent" text,
  "tool_name" text,
  "action_name" text,
  "model" text,
  "latency_ms" integer,
  "input_tokens" integer,
  "output_tokens" integer,
  "total_tokens" integer,
  "estimated_cost_usd" double precision,
  "error_text" text,
  "metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp NOT NULL
);
--> statement-breakpoint

ALTER TABLE "grace_audit_stream"
  ADD CONSTRAINT "grace_audit_stream_organization_id_organization_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "grace_audit_stream"
  ADD CONSTRAINT "grace_audit_stream_session_id_grace_session_id_fk"
  FOREIGN KEY ("session_id") REFERENCES "public"."grace_session"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "grace_audit_stream"
  ADD CONSTRAINT "grace_audit_stream_workflow_id_automation_workflow_id_fk"
  FOREIGN KEY ("workflow_id") REFERENCES "public"."automation_workflow"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "grace_audit_stream"
  ADD CONSTRAINT "grace_audit_stream_workflow_run_id_automation_workflow_run_id_fk"
  FOREIGN KEY ("workflow_run_id") REFERENCES "public"."automation_workflow_run"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

CREATE INDEX "grace_audit_stream_org_created_idx"
  ON "grace_audit_stream" USING btree ("organization_id", "created_at");
--> statement-breakpoint

CREATE INDEX "grace_audit_stream_org_event_created_idx"
  ON "grace_audit_stream" USING btree ("organization_id", "event_type", "created_at");
--> statement-breakpoint

CREATE INDEX "grace_audit_stream_org_status_created_idx"
  ON "grace_audit_stream" USING btree ("organization_id", "status", "created_at");
--> statement-breakpoint

CREATE INDEX "grace_audit_stream_org_model_created_idx"
  ON "grace_audit_stream" USING btree ("organization_id", "model", "created_at");
