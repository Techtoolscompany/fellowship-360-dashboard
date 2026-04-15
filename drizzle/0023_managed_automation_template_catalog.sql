CREATE TABLE "automation_template_catalog" (
  "id" text PRIMARY KEY NOT NULL,
  "key" text NOT NULL,
  "name" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "category" text DEFAULT 'Follow-Up' NOT NULL,
  "status" "automation_status" DEFAULT 'draft' NOT NULL,
  "trigger_event" text DEFAULT '' NOT NULL,
  "recommended_channels" jsonb DEFAULT '["sms"]'::jsonb NOT NULL,
  "definition_json" jsonb DEFAULT '{"version":1,"nodes":[]}'::jsonb NOT NULL,
  "validation_errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_by_user_id" text,
  "updated_by_user_id" text,
  "published_by_user_id" text,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL,
  "published_at" timestamp,
  "last_validated_at" timestamp
);
--> statement-breakpoint

ALTER TABLE "automation_template_catalog"
  ADD CONSTRAINT "automation_template_catalog_created_by_user_id_app_user_id_fk"
  FOREIGN KEY ("created_by_user_id") REFERENCES "public"."app_user"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "automation_template_catalog"
  ADD CONSTRAINT "automation_template_catalog_updated_by_user_id_app_user_id_fk"
  FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."app_user"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "automation_template_catalog"
  ADD CONSTRAINT "automation_template_catalog_published_by_user_id_app_user_id_fk"
  FOREIGN KEY ("published_by_user_id") REFERENCES "public"."app_user"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

CREATE UNIQUE INDEX "automation_template_catalog_key_uidx"
  ON "automation_template_catalog" USING btree ("key");
--> statement-breakpoint

CREATE INDEX "automation_template_catalog_status_idx"
  ON "automation_template_catalog" USING btree ("status", "updated_at");
--> statement-breakpoint

CREATE INDEX "automation_template_catalog_published_idx"
  ON "automation_template_catalog" USING btree ("status", "published_at");

