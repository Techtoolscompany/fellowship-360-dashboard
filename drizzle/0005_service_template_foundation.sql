CREATE TYPE "public"."service_template_type" AS ENUM(
  'sunday_am',
  'midweek',
  'special_event',
  'custom'
);
--> statement-breakpoint

CREATE TYPE "public"."service_template_role_assignment" AS ENUM(
  'paid_staff',
  'volunteer',
  'either'
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

ALTER TABLE "service_template"
  ADD CONSTRAINT "service_template_organization_id_organization_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "service_template"
  ADD CONSTRAINT "service_template_owner_user_id_app_user_id_fk"
  FOREIGN KEY ("owner_user_id") REFERENCES "public"."app_user"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

CREATE INDEX "service_template_org_type_idx"
  ON "service_template" USING btree ("organization_id", "service_type");
--> statement-breakpoint

CREATE INDEX "service_template_org_active_idx"
  ON "service_template" USING btree ("organization_id", "is_active");
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

ALTER TABLE "service_template_role_slot"
  ADD CONSTRAINT "service_template_role_slot_template_id_service_template_id_fk"
  FOREIGN KEY ("template_id") REFERENCES "public"."service_template"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

CREATE INDEX "service_template_role_slot_template_sort_idx"
  ON "service_template_role_slot" USING btree ("template_id", "sort_order");
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

ALTER TABLE "service_template_timeline_step"
  ADD CONSTRAINT "service_template_timeline_step_template_id_service_template_id_fk"
  FOREIGN KEY ("template_id") REFERENCES "public"."service_template"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "service_template_timeline_step"
  ADD CONSTRAINT "service_template_timeline_step_owner_role_slot_id_service_template_role_slot_id_fk"
  FOREIGN KEY ("owner_role_slot_id") REFERENCES "public"."service_template_role_slot"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "service_template_timeline_step"
  ADD CONSTRAINT "service_template_timeline_step_owner_user_id_app_user_id_fk"
  FOREIGN KEY ("owner_user_id") REFERENCES "public"."app_user"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

CREATE INDEX "service_template_timeline_step_template_offset_idx"
  ON "service_template_timeline_step" USING btree ("template_id", "offset_minutes");
--> statement-breakpoint

CREATE INDEX "service_template_timeline_step_template_sort_idx"
  ON "service_template_timeline_step" USING btree ("template_id", "sort_order");
