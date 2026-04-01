CREATE TYPE "public"."grace_knowledge_version_change_type" AS ENUM('create', 'update', 'delete');
--> statement-breakpoint

DO $$
BEGIN
  ALTER TYPE "public"."grace_memory_type" ADD VALUE IF NOT EXISTS 'service_recap';
END $$;
--> statement-breakpoint

CREATE TABLE "grace_knowledge_version" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "knowledge_id" text,
  "version_number" integer NOT NULL,
  "change_type" "grace_knowledge_version_change_type" NOT NULL,
  "title" text NOT NULL,
  "content" text NOT NULL,
  "tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "use_for_grace" boolean DEFAULT true NOT NULL,
  "visibility" "grace_knowledge_visibility" DEFAULT 'internal' NOT NULL,
  "change_summary" text,
  "changed_by_user_id" text,
  "created_at" timestamp NOT NULL
);
--> statement-breakpoint

ALTER TABLE "grace_knowledge_version"
  ADD CONSTRAINT "grace_knowledge_version_organization_id_organization_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "grace_knowledge_version"
  ADD CONSTRAINT "grace_knowledge_version_knowledge_id_grace_knowledge_id_fk"
  FOREIGN KEY ("knowledge_id") REFERENCES "public"."grace_knowledge"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "grace_knowledge_version"
  ADD CONSTRAINT "grace_knowledge_version_changed_by_user_id_app_user_id_fk"
  FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."app_user"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

CREATE INDEX "grace_knowledge_version_org_knowledge_version_idx"
  ON "grace_knowledge_version" USING btree ("organization_id", "knowledge_id", "version_number");
--> statement-breakpoint

CREATE INDEX "grace_knowledge_version_org_created_idx"
  ON "grace_knowledge_version" USING btree ("organization_id", "created_at");
--> statement-breakpoint

CREATE UNIQUE INDEX "grace_knowledge_version_knowledge_version_uidx"
  ON "grace_knowledge_version" USING btree ("knowledge_id", "version_number");
--> statement-breakpoint

ALTER TABLE "service_assignment"
  ADD COLUMN IF NOT EXISTS "checked_in_at" timestamp;
--> statement-breakpoint

ALTER TABLE "service_assignment"
  ADD COLUMN IF NOT EXISTS "checked_out_at" timestamp;
--> statement-breakpoint

ALTER TABLE "service_assignment"
  ADD COLUMN IF NOT EXISTS "payroll_exported_at" timestamp;
--> statement-breakpoint

CREATE INDEX "service_assignment_org_payroll_idx"
  ON "service_assignment" USING btree ("organization_id", "assignment_type", "status", "payroll_exported_at");
