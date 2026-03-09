CREATE TYPE "public"."grace_memory_type" AS ENUM('contact_memory', 'org_pattern', 'daily_briefing');
--> statement-breakpoint

CREATE TABLE "grace_memory" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "session_id" text,
  "contact_id" text,
  "memory_type" "grace_memory_type" NOT NULL,
  "summary" text NOT NULL,
  "details" text,
  "tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "metadata_json" jsonb,
  "created_by_actor_type" "grace_actor_type" DEFAULT 'system' NOT NULL,
  "created_by_user_id" text,
  "created_at" timestamp NOT NULL
);
--> statement-breakpoint

ALTER TABLE "grace_memory"
  ADD CONSTRAINT "grace_memory_organization_id_organization_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "grace_memory"
  ADD CONSTRAINT "grace_memory_session_id_grace_session_id_fk"
  FOREIGN KEY ("session_id") REFERENCES "public"."grace_session"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "grace_memory"
  ADD CONSTRAINT "grace_memory_contact_id_church_contact_id_fk"
  FOREIGN KEY ("contact_id") REFERENCES "public"."church_contact"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "grace_memory"
  ADD CONSTRAINT "grace_memory_created_by_user_id_app_user_id_fk"
  FOREIGN KEY ("created_by_user_id") REFERENCES "public"."app_user"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "grace_memory"
  ADD CONSTRAINT "grace_memory_contact_memory_requires_contact"
  CHECK (
    ("memory_type" <> 'contact_memory')
    OR
    ("contact_id" IS NOT NULL)
  );
--> statement-breakpoint

CREATE INDEX "grace_memory_org_type_created_idx"
  ON "grace_memory" USING btree ("organization_id", "memory_type", "created_at");
--> statement-breakpoint

CREATE INDEX "grace_memory_org_contact_created_idx"
  ON "grace_memory" USING btree ("organization_id", "contact_id", "created_at");
--> statement-breakpoint

CREATE INDEX "grace_memory_session_idx"
  ON "grace_memory" USING btree ("session_id");
