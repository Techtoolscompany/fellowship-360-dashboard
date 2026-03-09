CREATE TYPE "public"."service_scheduling_person_type" AS ENUM('contact', 'staff');
--> statement-breakpoint

CREATE TABLE "service_scheduling_profile" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "person_type" "service_scheduling_person_type" NOT NULL,
  "contact_id" text,
  "staff_user_id" text,
  "is_schedulable" boolean DEFAULT true NOT NULL,
  "preferred_roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "availability_slots" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "notes" text,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);
--> statement-breakpoint

ALTER TABLE "service_scheduling_profile"
  ADD CONSTRAINT "service_scheduling_profile_organization_id_organization_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "service_scheduling_profile"
  ADD CONSTRAINT "service_scheduling_profile_contact_id_church_contact_id_fk"
  FOREIGN KEY ("contact_id") REFERENCES "public"."church_contact"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "service_scheduling_profile"
  ADD CONSTRAINT "service_scheduling_profile_staff_user_id_app_user_id_fk"
  FOREIGN KEY ("staff_user_id") REFERENCES "public"."app_user"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "service_scheduling_profile"
  ADD CONSTRAINT "service_scheduling_profile_person_check"
  CHECK (
    ("person_type" = 'contact' AND "contact_id" IS NOT NULL AND "staff_user_id" IS NULL)
    OR
    ("person_type" = 'staff' AND "staff_user_id" IS NOT NULL AND "contact_id" IS NULL)
  );
--> statement-breakpoint

CREATE INDEX "service_scheduling_profile_org_person_type_idx"
  ON "service_scheduling_profile" USING btree ("organization_id", "person_type");
--> statement-breakpoint

CREATE INDEX "service_scheduling_profile_org_schedulable_idx"
  ON "service_scheduling_profile" USING btree ("organization_id", "is_schedulable");
--> statement-breakpoint

CREATE UNIQUE INDEX "service_scheduling_profile_org_contact_uidx"
  ON "service_scheduling_profile" USING btree ("organization_id", "contact_id");
--> statement-breakpoint

CREATE UNIQUE INDEX "service_scheduling_profile_org_staff_uidx"
  ON "service_scheduling_profile" USING btree ("organization_id", "staff_user_id");
