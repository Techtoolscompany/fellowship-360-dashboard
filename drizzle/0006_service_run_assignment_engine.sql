CREATE TYPE "public"."service_run_status" AS ENUM(
  'planned',
  'in_progress',
  'completed',
  'cancelled'
);
--> statement-breakpoint

CREATE TYPE "public"."service_assignment_status" AS ENUM(
  'proposed',
  'offered',
  'confirmed',
  'declined',
  'needs_replacement',
  'checked_in',
  'checked_out',
  'no_show',
  'cancelled'
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

ALTER TABLE "service_run"
  ADD CONSTRAINT "service_run_organization_id_organization_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "service_run"
  ADD CONSTRAINT "service_run_template_id_service_template_id_fk"
  FOREIGN KEY ("template_id") REFERENCES "public"."service_template"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "service_run"
  ADD CONSTRAINT "service_run_created_by_user_id_app_user_id_fk"
  FOREIGN KEY ("created_by_user_id") REFERENCES "public"."app_user"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

CREATE INDEX "service_run_org_service_at_idx"
  ON "service_run" USING btree ("organization_id", "service_at");
--> statement-breakpoint

CREATE INDEX "service_run_org_status_idx"
  ON "service_run" USING btree ("organization_id", "status");
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

ALTER TABLE "service_assignment"
  ADD CONSTRAINT "service_assignment_organization_id_organization_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "service_assignment"
  ADD CONSTRAINT "service_assignment_service_run_id_service_run_id_fk"
  FOREIGN KEY ("service_run_id") REFERENCES "public"."service_run"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "service_assignment"
  ADD CONSTRAINT "service_assignment_template_id_service_template_id_fk"
  FOREIGN KEY ("template_id") REFERENCES "public"."service_template"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "service_assignment"
  ADD CONSTRAINT "service_assignment_role_slot_id_service_template_role_slot_id_fk"
  FOREIGN KEY ("role_slot_id") REFERENCES "public"."service_template_role_slot"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "service_assignment"
  ADD CONSTRAINT "service_assignment_volunteer_id_volunteer_id_fk"
  FOREIGN KEY ("volunteer_id") REFERENCES "public"."volunteer"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "service_assignment"
  ADD CONSTRAINT "service_assignment_staff_user_id_app_user_id_fk"
  FOREIGN KEY ("staff_user_id") REFERENCES "public"."app_user"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

CREATE INDEX "service_assignment_run_status_idx"
  ON "service_assignment" USING btree ("service_run_id", "status");
--> statement-breakpoint

CREATE INDEX "service_assignment_org_status_idx"
  ON "service_assignment" USING btree ("organization_id", "status");
--> statement-breakpoint

CREATE INDEX "service_assignment_role_type_idx"
  ON "service_assignment" USING btree ("role_name", "assignment_type");
