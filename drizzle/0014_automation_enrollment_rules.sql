CREATE TYPE "public"."automation_enrollment_mode" AS ENUM('every_trigger', 'once_per_contact', 'cooldown');
--> statement-breakpoint

ALTER TABLE "automation_workflow"
  ADD COLUMN "enrollment_mode" "automation_enrollment_mode" DEFAULT 'once_per_contact' NOT NULL;
--> statement-breakpoint

ALTER TABLE "automation_workflow"
  ADD COLUMN "reentry_cooldown_minutes" integer DEFAULT 10080 NOT NULL;
