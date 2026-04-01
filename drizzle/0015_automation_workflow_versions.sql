CREATE TABLE "automation_workflow_version" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "workflow_id" text NOT NULL,
  "version_number" integer NOT NULL,
  "trigger_event" text,
  "definition_json" jsonb NOT NULL,
  "policy_json" jsonb NOT NULL,
  "published_by_user_id" text,
  "created_at" timestamp NOT NULL
);
--> statement-breakpoint

ALTER TABLE "automation_workflow_version"
  ADD CONSTRAINT "automation_workflow_version_organization_id_organization_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "automation_workflow_version"
  ADD CONSTRAINT "automation_workflow_version_workflow_id_automation_workflow_id_fk"
  FOREIGN KEY ("workflow_id") REFERENCES "public"."automation_workflow"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "automation_workflow_version"
  ADD CONSTRAINT "automation_workflow_version_published_by_user_id_app_user_id_fk"
  FOREIGN KEY ("published_by_user_id") REFERENCES "public"."app_user"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

CREATE UNIQUE INDEX "automation_workflow_version_workflow_version_uidx"
  ON "automation_workflow_version" USING btree ("workflow_id", "version_number");
--> statement-breakpoint

CREATE INDEX "automation_workflow_version_workflow_created_idx"
  ON "automation_workflow_version" USING btree ("workflow_id", "created_at");
--> statement-breakpoint

CREATE INDEX "automation_workflow_version_org_created_idx"
  ON "automation_workflow_version" USING btree ("organization_id", "created_at");
--> statement-breakpoint

CREATE INDEX "automation_workflow_version_org_workflow_idx"
  ON "automation_workflow_version" USING btree ("organization_id", "workflow_id");
