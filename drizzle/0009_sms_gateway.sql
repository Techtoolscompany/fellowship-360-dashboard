CREATE TYPE "public"."grace_contact_match_outcome" AS ENUM('matched_existing', 'created_new', 'created_review_candidate');--> statement-breakpoint
CREATE TYPE "public"."grace_followup_proposal_status" AS ENUM('pending', 'approved', 'rejected', 'sent');--> statement-breakpoint
CREATE TYPE "public"."grace_goal_status" AS ENUM('queued', 'in_progress', 'waiting', 'completed', 'failed', 'cancelled', 'escalated');--> statement-breakpoint
CREATE TYPE "public"."grace_goal_step_status" AS ENUM('pending', 'in_progress', 'waiting', 'completed', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."grace_goal_type" AS ENUM('service_staffing', 'communications_followup', 'operations', 'custom');--> statement-breakpoint
CREATE TYPE "public"."grace_handoff_status" AS ENUM('open', 'acknowledged', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."grace_knowledge_visibility" AS ENUM('public', 'internal');--> statement-breakpoint
CREATE TYPE "public"."grace_actor_type" AS ENUM('staff', 'public', 'system');--> statement-breakpoint
CREATE TYPE "public"."service_assignment_status" AS ENUM('proposed', 'offered', 'confirmed', 'declined', 'needs_replacement', 'checked_in', 'checked_out', 'no_show', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."service_run_status" AS ENUM('planned', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."service_template_role_assignment" AS ENUM('paid_staff', 'volunteer', 'either');--> statement-breakpoint
CREATE TYPE "public"."service_template_type" AS ENUM('sunday_am', 'midweek', 'special_event', 'custom');--> statement-breakpoint
CREATE TYPE "public"."sms_direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."sms_status" AS ENUM('queued', 'sent', 'delivered', 'failed');--> statement-breakpoint
ALTER TYPE "public"."grace_channel" ADD VALUE 'voice_internal' BEFORE 'sms';--> statement-breakpoint
ALTER TYPE "public"."grace_channel" ADD VALUE 'voice_public' BEFORE 'sms';--> statement-breakpoint
ALTER TYPE "public"."grace_channel" ADD VALUE 'sms_public' BEFORE 'web';--> statement-breakpoint
ALTER TYPE "public"."grace_channel" ADD VALUE 'web_public' BEFORE 'in_app';--> statement-breakpoint
CREATE TABLE "action_audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"action_type" text NOT NULL,
	"entity_name" text NOT NULL,
	"entity_id" text,
	"details" jsonb,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grace_contact_match_audit" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"session_id" text NOT NULL,
	"matched_contact_id" text,
	"created_contact_id" text,
	"confidence_score" integer DEFAULT 0 NOT NULL,
	"confidence_tier" text NOT NULL,
	"outcome" "grace_contact_match_outcome" NOT NULL,
	"requires_review" boolean DEFAULT false NOT NULL,
	"input_json" jsonb,
	"candidate_json" jsonb,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grace_followup_proposal" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"session_id" text NOT NULL,
	"contact_id" text,
	"actor_type" "grace_actor_type" NOT NULL,
	"channel" text NOT NULL,
	"proposed_channel" text DEFAULT 'sms' NOT NULL,
	"recipient" text,
	"subject" text,
	"message_text" text NOT NULL,
	"reason" text,
	"metadata_json" jsonb,
	"status" "grace_followup_proposal_status" DEFAULT 'pending' NOT NULL,
	"approved_by_user_id" text,
	"approved_at" timestamp,
	"created_at" timestamp NOT NULL
);
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
CREATE TABLE "grace_handoff" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"session_id" text NOT NULL,
	"contact_id" text,
	"actor_type" "grace_actor_type" NOT NULL,
	"reason" text NOT NULL,
	"summary_text" text,
	"assigned_team" text,
	"metadata_json" jsonb,
	"status" "grace_handoff_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "service_assignment" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"service_run_id" text NOT NULL,
	"template_id" text,
	"role_slot_id" text,
	"role_name" text NOT NULL,
	"assignment_type" "service_template_role_assignment" DEFAULT 'volunteer' NOT NULL,
	"volunteer_id" text,
	"staff_user_id" text,
	"status" "service_assignment_status" DEFAULT 'proposed' NOT NULL,
	"offered_at" timestamp,
	"responded_at" timestamp,
	"response_channel" text,
	"response_text" text,
	"notes" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_run" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"template_id" text,
	"name" text NOT NULL,
	"service_at" timestamp NOT NULL,
	"duration_minutes" integer DEFAULT 90 NOT NULL,
	"status" "service_run_status" DEFAULT 'planned' NOT NULL,
	"notes" text,
	"created_by_user_id" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_template_role_slot" (
	"id" text PRIMARY KEY NOT NULL,
	"template_id" text NOT NULL,
	"role_name" text NOT NULL,
	"assignment_type" "service_template_role_assignment" DEFAULT 'volunteer' NOT NULL,
	"required_count" integer DEFAULT 1 NOT NULL,
	"is_required" boolean DEFAULT true NOT NULL,
	"notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_template_timeline_step" (
	"id" text PRIMARY KEY NOT NULL,
	"template_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"offset_minutes" integer NOT NULL,
	"duration_minutes" integer,
	"owner_role_slot_id" text,
	"owner_user_id" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_template" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"service_type" "service_template_type" DEFAULT 'custom' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"service_start_time" text,
	"owner_user_id" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sms_devices" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text,
	"device_name" text NOT NULL,
	"phone_number" text,
	"fcm_token" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_seen_at" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sms_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"device_id" text,
	"direction" "sms_direction" NOT NULL,
	"from_number" text,
	"to_number" text,
	"body" text NOT NULL,
	"status" "sms_status" DEFAULT 'queued' NOT NULL,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
DROP INDEX "provider_config_org_channel_idx";--> statement-breakpoint
ALTER TABLE "ai_config" ADD COLUMN "internal_grace_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_config" ADD COLUMN "public_grace_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_config" ADD COLUMN "public_widget_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_config" ADD COLUMN "public_phone_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_config" ADD COLUMN "is_demo_organization" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "grace_knowledge" ADD COLUMN "visibility" "grace_knowledge_visibility" DEFAULT 'internal' NOT NULL;--> statement-breakpoint
ALTER TABLE "grace_message" ADD COLUMN "metadata_json" jsonb;--> statement-breakpoint
ALTER TABLE "grace_session" ADD COLUMN "actor_type" "grace_actor_type" DEFAULT 'staff' NOT NULL;--> statement-breakpoint
ALTER TABLE "grace_session" ADD COLUMN "origin_surface" text;--> statement-breakpoint
ALTER TABLE "grace_session" ADD COLUMN "matched_contact_id" text;--> statement-breakpoint
ALTER TABLE "grace_session" ADD COLUMN "match_confidence" text;--> statement-breakpoint
ALTER TABLE "grace_session" ADD COLUMN "requires_review" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "grace_tool_audit" ADD COLUMN "actor_type" "grace_actor_type" DEFAULT 'staff' NOT NULL;--> statement-breakpoint
ALTER TABLE "grace_tool_audit" ADD COLUMN "channel" "grace_channel" DEFAULT 'in_app' NOT NULL;--> statement-breakpoint
ALTER TABLE "action_audit_log" ADD CONSTRAINT "action_audit_log_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_audit_log" ADD CONSTRAINT "action_audit_log_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grace_contact_match_audit" ADD CONSTRAINT "grace_contact_match_audit_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grace_contact_match_audit" ADD CONSTRAINT "grace_contact_match_audit_session_id_grace_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."grace_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grace_contact_match_audit" ADD CONSTRAINT "grace_contact_match_audit_matched_contact_id_church_contact_id_fk" FOREIGN KEY ("matched_contact_id") REFERENCES "public"."church_contact"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grace_contact_match_audit" ADD CONSTRAINT "grace_contact_match_audit_created_contact_id_church_contact_id_fk" FOREIGN KEY ("created_contact_id") REFERENCES "public"."church_contact"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grace_followup_proposal" ADD CONSTRAINT "grace_followup_proposal_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grace_followup_proposal" ADD CONSTRAINT "grace_followup_proposal_session_id_grace_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."grace_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grace_followup_proposal" ADD CONSTRAINT "grace_followup_proposal_contact_id_church_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."church_contact"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grace_followup_proposal" ADD CONSTRAINT "grace_followup_proposal_approved_by_user_id_app_user_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."app_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grace_goal_step" ADD CONSTRAINT "grace_goal_step_goal_id_grace_goal_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."grace_goal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grace_goal_step" ADD CONSTRAINT "grace_goal_step_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grace_goal" ADD CONSTRAINT "grace_goal_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grace_goal" ADD CONSTRAINT "grace_goal_service_run_id_service_run_id_fk" FOREIGN KEY ("service_run_id") REFERENCES "public"."service_run"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grace_goal" ADD CONSTRAINT "grace_goal_requested_by_user_id_app_user_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."app_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grace_handoff" ADD CONSTRAINT "grace_handoff_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grace_handoff" ADD CONSTRAINT "grace_handoff_session_id_grace_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."grace_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grace_handoff" ADD CONSTRAINT "grace_handoff_contact_id_church_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."church_contact"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_assignment" ADD CONSTRAINT "service_assignment_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_assignment" ADD CONSTRAINT "service_assignment_service_run_id_service_run_id_fk" FOREIGN KEY ("service_run_id") REFERENCES "public"."service_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_assignment" ADD CONSTRAINT "service_assignment_template_id_service_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."service_template"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_assignment" ADD CONSTRAINT "service_assignment_role_slot_id_service_template_role_slot_id_fk" FOREIGN KEY ("role_slot_id") REFERENCES "public"."service_template_role_slot"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_assignment" ADD CONSTRAINT "service_assignment_volunteer_id_volunteer_id_fk" FOREIGN KEY ("volunteer_id") REFERENCES "public"."volunteer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_assignment" ADD CONSTRAINT "service_assignment_staff_user_id_app_user_id_fk" FOREIGN KEY ("staff_user_id") REFERENCES "public"."app_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_run" ADD CONSTRAINT "service_run_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_run" ADD CONSTRAINT "service_run_template_id_service_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."service_template"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_run" ADD CONSTRAINT "service_run_created_by_user_id_app_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."app_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_template_role_slot" ADD CONSTRAINT "service_template_role_slot_template_id_service_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."service_template"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_template_timeline_step" ADD CONSTRAINT "service_template_timeline_step_template_id_service_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."service_template"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_template_timeline_step" ADD CONSTRAINT "service_template_timeline_step_owner_role_slot_id_service_template_role_slot_id_fk" FOREIGN KEY ("owner_role_slot_id") REFERENCES "public"."service_template_role_slot"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_template_timeline_step" ADD CONSTRAINT "service_template_timeline_step_owner_user_id_app_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."app_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_template" ADD CONSTRAINT "service_template_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_template" ADD CONSTRAINT "service_template_owner_user_id_app_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."app_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_devices" ADD CONSTRAINT "sms_devices_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_device_id_sms_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."sms_devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "grace_contact_match_audit_org_created_idx" ON "grace_contact_match_audit" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "grace_contact_match_audit_session_idx" ON "grace_contact_match_audit" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "grace_followup_proposal_org_status_idx" ON "grace_followup_proposal" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "grace_followup_proposal_session_idx" ON "grace_followup_proposal" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "grace_goal_step_goal_order_idx" ON "grace_goal_step" USING btree ("goal_id","run_order");--> statement-breakpoint
CREATE INDEX "grace_goal_step_org_status_idx" ON "grace_goal_step" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "grace_goal_step_goal_key_idx" ON "grace_goal_step" USING btree ("goal_id","step_key");--> statement-breakpoint
CREATE INDEX "grace_goal_org_status_idx" ON "grace_goal" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "grace_goal_org_type_idx" ON "grace_goal" USING btree ("organization_id","goal_type");--> statement-breakpoint
CREATE INDEX "grace_goal_run_status_idx" ON "grace_goal" USING btree ("service_run_id","status");--> statement-breakpoint
CREATE INDEX "grace_handoff_org_status_idx" ON "grace_handoff" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "grace_handoff_session_idx" ON "grace_handoff" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "service_assignment_run_status_idx" ON "service_assignment" USING btree ("service_run_id","status");--> statement-breakpoint
CREATE INDEX "service_assignment_org_status_idx" ON "service_assignment" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "service_assignment_role_type_idx" ON "service_assignment" USING btree ("role_name","assignment_type");--> statement-breakpoint
CREATE INDEX "service_run_org_service_at_idx" ON "service_run" USING btree ("organization_id","service_at");--> statement-breakpoint
CREATE INDEX "service_run_org_status_idx" ON "service_run" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "service_template_role_slot_template_sort_idx" ON "service_template_role_slot" USING btree ("template_id","sort_order");--> statement-breakpoint
CREATE INDEX "service_template_timeline_step_template_offset_idx" ON "service_template_timeline_step" USING btree ("template_id","offset_minutes");--> statement-breakpoint
CREATE INDEX "service_template_timeline_step_template_sort_idx" ON "service_template_timeline_step" USING btree ("template_id","sort_order");--> statement-breakpoint
CREATE INDEX "service_template_org_type_idx" ON "service_template" USING btree ("organization_id","service_type");--> statement-breakpoint
CREATE INDEX "service_template_org_active_idx" ON "service_template" USING btree ("organization_id","is_active");--> statement-breakpoint
ALTER TABLE "grace_session" ADD CONSTRAINT "grace_session_matched_contact_id_church_contact_id_fk" FOREIGN KEY ("matched_contact_id") REFERENCES "public"."church_contact"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "provider_config_org_channel_provider_uidx" ON "provider_config" USING btree ("organization_id","channel","provider");