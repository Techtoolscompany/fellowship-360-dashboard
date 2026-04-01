CREATE TABLE "organization_role_access_policy" (
	"organization_id" text NOT NULL,
	"role" "role" NOT NULL,
	"allowed_sections" text[] DEFAULT '{}'::text[] NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "organization_role_access_policy_organization_id_role_pk" PRIMARY KEY("organization_id","role")
);
--> statement-breakpoint
ALTER TABLE "organization_role_access_policy" ADD CONSTRAINT "organization_role_access_policy_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "organization_role_access_policy_org_idx" ON "organization_role_access_policy" USING btree ("organization_id");

