DO $$ BEGIN
 CREATE TYPE "public"."super_admin_role" AS ENUM('owner', 'operator', 'support', 'finance');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."super_admin_membership_status" AS ENUM('active', 'suspended', 'revoked');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."super_admin_invitation_status" AS ENUM('pending', 'accepted', 'revoked', 'expired');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "super_admin_membership" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "role" "super_admin_role" DEFAULT 'operator' NOT NULL,
  "status" "super_admin_membership_status" DEFAULT 'active' NOT NULL,
  "created_by_id" text,
  "updated_by_id" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "super_admin_invitation" (
  "id" text PRIMARY KEY NOT NULL,
  "email" text NOT NULL,
  "role" "super_admin_role" NOT NULL,
  "status" "super_admin_invitation_status" DEFAULT 'pending' NOT NULL,
  "token" text NOT NULL,
  "invited_by_id" text,
  "accepted_by_id" text,
  "accepted_at" timestamp,
  "revoked_at" timestamp,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "super_admin_audit_log" (
  "id" text PRIMARY KEY NOT NULL,
  "actor_user_id" text,
  "action_type" text NOT NULL,
  "entity_name" text NOT NULL,
  "entity_id" text,
  "details" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "super_admin_membership"
 ADD CONSTRAINT "super_admin_membership_user_id_app_user_id_fk"
 FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "super_admin_membership"
 ADD CONSTRAINT "super_admin_membership_created_by_id_app_user_id_fk"
 FOREIGN KEY ("created_by_id") REFERENCES "public"."app_user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "super_admin_membership"
 ADD CONSTRAINT "super_admin_membership_updated_by_id_app_user_id_fk"
 FOREIGN KEY ("updated_by_id") REFERENCES "public"."app_user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "super_admin_invitation"
 ADD CONSTRAINT "super_admin_invitation_invited_by_id_app_user_id_fk"
 FOREIGN KEY ("invited_by_id") REFERENCES "public"."app_user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "super_admin_invitation"
 ADD CONSTRAINT "super_admin_invitation_accepted_by_id_app_user_id_fk"
 FOREIGN KEY ("accepted_by_id") REFERENCES "public"."app_user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "super_admin_audit_log"
 ADD CONSTRAINT "super_admin_audit_log_actor_user_id_app_user_id_fk"
 FOREIGN KEY ("actor_user_id") REFERENCES "public"."app_user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "super_admin_membership_user_uidx" ON "super_admin_membership" ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "super_admin_invitation_token_uidx" ON "super_admin_invitation" ("token");
