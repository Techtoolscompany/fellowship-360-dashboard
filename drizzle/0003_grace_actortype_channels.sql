-- Migration: Grace actor type enum, extended channel variants, and new session/audit columns
-- Adds columns/enums that exist in schema files but were never migrated.

-- 1. Extend grace_channel enum with public/internal surface variants
ALTER TYPE "public"."grace_channel" ADD VALUE 'voice_internal';
ALTER TYPE "public"."grace_channel" ADD VALUE 'voice_public';
ALTER TYPE "public"."grace_channel" ADD VALUE 'sms_public';
ALTER TYPE "public"."grace_channel" ADD VALUE 'web_public';
--> statement-breakpoint

-- 2. Create grace_actor_type enum
CREATE TYPE "public"."grace_actor_type" AS ENUM('staff', 'public', 'system');
--> statement-breakpoint

-- 3. Add actor_type to grace_session
ALTER TABLE "grace_session" ADD COLUMN "actor_type" "grace_actor_type" NOT NULL DEFAULT 'staff';
--> statement-breakpoint

-- 4. Add origin_surface to grace_session
ALTER TABLE "grace_session" ADD COLUMN "origin_surface" text;
--> statement-breakpoint

-- 5. Add matched_contact_id to grace_session
ALTER TABLE "grace_session" ADD COLUMN "matched_contact_id" text
  REFERENCES "public"."church_contacts"("id") ON DELETE SET NULL;
--> statement-breakpoint

-- 6. Add match_confidence to grace_session
ALTER TABLE "grace_session" ADD COLUMN "match_confidence" text;
--> statement-breakpoint

-- 7. Add requires_review to grace_session
ALTER TABLE "grace_session" ADD COLUMN "requires_review" boolean NOT NULL DEFAULT false;
--> statement-breakpoint

-- 8. Add actor_type to grace_tool_audit (was defaulting to wrong value before this migration)
ALTER TABLE "grace_tool_audit" ADD COLUMN "actor_type" "grace_actor_type" NOT NULL DEFAULT 'staff';
--> statement-breakpoint

-- 9. Add channel to grace_tool_audit
ALTER TABLE "grace_tool_audit" ADD COLUMN "channel" "grace_channel" NOT NULL DEFAULT 'in_app';
--> statement-breakpoint
