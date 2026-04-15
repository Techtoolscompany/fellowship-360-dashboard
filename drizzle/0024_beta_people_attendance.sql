ALTER TABLE "church_contact"
  ADD COLUMN "member_since_date" timestamp;
--> statement-breakpoint

CREATE TYPE "public"."attendance_session_type" AS ENUM('worship', 'ministry', 'service');
--> statement-breakpoint

CREATE TYPE "public"."attendance_entry_status" AS ENUM('present', 'absent', 'served');
--> statement-breakpoint

CREATE TYPE "public"."attendance_entry_source" AS ENUM('manual', 'import', 'service_run', 'ministry', 'worship');
--> statement-breakpoint

CREATE TABLE "attendance_session" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "type" "attendance_session_type" NOT NULL,
  "name" text NOT NULL,
  "occurred_at" timestamp NOT NULL,
  "ministry_id" text,
  "service_run_id" text,
  "notes" text,
  "created_by_user_id" text,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);
--> statement-breakpoint

CREATE TABLE "attendance_entry" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "session_id" text NOT NULL,
  "contact_id" text NOT NULL,
  "status" "attendance_entry_status" DEFAULT 'present' NOT NULL,
  "source" "attendance_entry_source" DEFAULT 'manual' NOT NULL,
  "notes" text,
  "recorded_by_user_id" text,
  "recorded_at" timestamp NOT NULL,
  "created_at" timestamp NOT NULL
);
--> statement-breakpoint

ALTER TABLE "attendance_session"
  ADD CONSTRAINT "attendance_session_organization_id_organization_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "attendance_session"
  ADD CONSTRAINT "attendance_session_ministry_id_ministry_id_fk"
  FOREIGN KEY ("ministry_id") REFERENCES "public"."ministry"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "attendance_session"
  ADD CONSTRAINT "attendance_session_service_run_id_service_run_id_fk"
  FOREIGN KEY ("service_run_id") REFERENCES "public"."service_run"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "attendance_session"
  ADD CONSTRAINT "attendance_session_created_by_user_id_app_user_id_fk"
  FOREIGN KEY ("created_by_user_id") REFERENCES "public"."app_user"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "attendance_entry"
  ADD CONSTRAINT "attendance_entry_organization_id_organization_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "attendance_entry"
  ADD CONSTRAINT "attendance_entry_session_id_attendance_session_id_fk"
  FOREIGN KEY ("session_id") REFERENCES "public"."attendance_session"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "attendance_entry"
  ADD CONSTRAINT "attendance_entry_contact_id_church_contact_id_fk"
  FOREIGN KEY ("contact_id") REFERENCES "public"."church_contact"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "attendance_entry"
  ADD CONSTRAINT "attendance_entry_recorded_by_user_id_app_user_id_fk"
  FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."app_user"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

CREATE INDEX "attendance_session_org_occurred_at_idx"
  ON "attendance_session" USING btree ("organization_id", "occurred_at");
--> statement-breakpoint

CREATE INDEX "attendance_session_org_type_occurred_at_idx"
  ON "attendance_session" USING btree ("organization_id", "type", "occurred_at");
--> statement-breakpoint

CREATE INDEX "attendance_session_ministry_occurred_at_idx"
  ON "attendance_session" USING btree ("ministry_id", "occurred_at");
--> statement-breakpoint

CREATE UNIQUE INDEX "attendance_session_service_run_uidx"
  ON "attendance_session" USING btree ("service_run_id");
--> statement-breakpoint

CREATE UNIQUE INDEX "attendance_entry_session_contact_uidx"
  ON "attendance_entry" USING btree ("session_id", "contact_id");
--> statement-breakpoint

CREATE INDEX "attendance_entry_org_contact_recorded_at_idx"
  ON "attendance_entry" USING btree ("organization_id", "contact_id", "recorded_at");
--> statement-breakpoint

CREATE INDEX "attendance_entry_session_status_idx"
  ON "attendance_entry" USING btree ("session_id", "status");
