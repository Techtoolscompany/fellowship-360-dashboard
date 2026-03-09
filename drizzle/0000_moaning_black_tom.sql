CREATE TYPE "public"."contact_source" AS ENUM('walk_in', 'website', 'referral', 'event', 'social_media', 'other');--> statement-breakpoint
CREATE TYPE "public"."member_status" AS ENUM('visitor', 'prospect', 'regular_attendee', 'member', 'leader', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."broadcast_status" AS ENUM('draft', 'scheduled', 'sending', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."comm_channel" AS ENUM('phone', 'sms', 'email', 'web', 'in_person');--> statement-breakpoint
CREATE TYPE "public"."conversation_status" AS ENUM('open', 'waiting', 'resolved', 'archived');--> statement-breakpoint
CREATE TYPE "public"."message_direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."message_sender_type" AS ENUM('human', 'ai', 'system');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('credit', 'debit', 'expired');--> statement-breakpoint
CREATE TYPE "public"."donation_method" AS ENUM('cash', 'check', 'card', 'online', 'bank_transfer', 'other');--> statement-breakpoint
CREATE TYPE "public"."pledge_frequency" AS ENUM('one_time', 'weekly', 'biweekly', 'monthly', 'quarterly', 'annually');--> statement-breakpoint
CREATE TYPE "public"."grace_approval_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."grace_message_direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."grace_channel" AS ENUM('voice', 'sms', 'web', 'in_app');--> statement-breakpoint
CREATE TYPE "public"."grace_session_status" AS ENUM('open', 'closed', 'escalated');--> statement-breakpoint
CREATE TYPE "public"."grace_tool_audit_status" AS ENUM('success', 'error');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('admin', 'owner', 'user');--> statement-breakpoint
CREATE TYPE "public"."pipeline_priority" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."ministry_role" AS ENUM('leader', 'co_leader', 'member', 'volunteer');--> statement-breakpoint
CREATE TYPE "public"."appointment_status" AS ENUM('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."task_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('todo', 'in_progress', 'done', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."volunteer_status" AS ENUM('active', 'inactive', 'pending');--> statement-breakpoint
CREATE TYPE "public"."prayer_status" AS ENUM('new', 'praying', 'answered', 'archived');--> statement-breakpoint
CREATE TYPE "public"."prayer_urgency" AS ENUM('normal', 'urgent', 'critical');--> statement-breakpoint
CREATE TYPE "public"."provider_mode" AS ENUM('agency_managed', 'byo', 'disabled');--> statement-breakpoint
CREATE TABLE "ai_config" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"custom_system_prompt" text,
	"church_name" text NOT NULL,
	"church_denomination" text,
	"church_city" text,
	"grace_enabled" boolean DEFAULT true NOT NULL,
	"temperature_override" double precision,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "church_contact" (
	"id" text PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text,
	"phone" text,
	"member_status" "member_status" DEFAULT 'visitor' NOT NULL,
	"source" "contact_source" DEFAULT 'walk_in',
	"family_id" text,
	"avatar_url" text,
	"date_of_birth" timestamp,
	"first_visit_date" timestamp,
	"notes" text,
	"organization_id" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_tag" (
	"id" text PRIMARY KEY NOT NULL,
	"contact_id" text NOT NULL,
	"tag" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "family" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"city" text,
	"state" text,
	"zip_code" text,
	"organization_id" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "broadcast" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"channel" "comm_channel" NOT NULL,
	"status" "broadcast_status" DEFAULT 'draft' NOT NULL,
	"audience_filter" jsonb,
	"scheduled_at" timestamp,
	"sent_at" timestamp,
	"total_recipients" integer DEFAULT 0,
	"total_delivered" integer DEFAULT 0,
	"total_opened" integer DEFAULT 0,
	"organization_id" text NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation" (
	"id" text PRIMARY KEY NOT NULL,
	"contact_id" text,
	"channel" "comm_channel" NOT NULL,
	"status" "conversation_status" DEFAULT 'open' NOT NULL,
	"subject" text,
	"assignee_id" text,
	"organization_id" text NOT NULL,
	"last_message_at" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_template" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"content" text NOT NULL,
	"category" text,
	"channel" "comm_channel",
	"variables" jsonb,
	"organization_id" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"content" text NOT NULL,
	"direction" "message_direction" NOT NULL,
	"sender_type" "message_sender_type" DEFAULT 'human' NOT NULL,
	"sender_id" text,
	"sent_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"company" text,
	"message" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"read_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "coupon" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"organizationId" text,
	"usedByUserId" text,
	"createdAt" timestamp DEFAULT now(),
	"usedAt" timestamp,
	"expired" boolean DEFAULT false,
	CONSTRAINT "coupon_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "credit_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text,
	"organizationId" text NOT NULL,
	"transaction_type" "transaction_type" NOT NULL,
	"credit_type" text NOT NULL,
	"amount" integer NOT NULL,
	"payment_id" text,
	"expiration_date" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "donation" (
	"id" text PRIMARY KEY NOT NULL,
	"contact_id" text,
	"amount" real NOT NULL,
	"date" timestamp NOT NULL,
	"method" "donation_method" DEFAULT 'cash',
	"fund" text DEFAULT 'General',
	"memo" text,
	"receipt_sent" boolean DEFAULT false,
	"organization_id" text NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pledge" (
	"id" text PRIMARY KEY NOT NULL,
	"contact_id" text,
	"total_amount" real NOT NULL,
	"amount_paid" real DEFAULT 0 NOT NULL,
	"frequency" "pledge_frequency" DEFAULT 'monthly' NOT NULL,
	"fund" text DEFAULT 'General',
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"notes" text,
	"organization_id" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grace_approval" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"session_id" text NOT NULL,
	"requested_by_user_id" text,
	"decided_by_user_id" text,
	"proposed_action" jsonb NOT NULL,
	"status" "grace_approval_status" DEFAULT 'pending' NOT NULL,
	"decision_note" text,
	"created_at" timestamp NOT NULL,
	"decided_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "grace_call" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"session_id" text NOT NULL,
	"contact_id" text,
	"external_call_id" text,
	"from_number" text,
	"to_number" text,
	"started_at" timestamp,
	"ended_at" timestamp,
	"duration_sec" integer,
	"recording_url" text,
	"transcript_text" text,
	"summary_text" text,
	"intent" text,
	"outcome" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grace_knowledge" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"use_for_grace" boolean DEFAULT true NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grace_message" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"session_id" text NOT NULL,
	"contact_id" text,
	"direction" "grace_message_direction" NOT NULL,
	"channel" text NOT NULL,
	"message_text" text NOT NULL,
	"provider_message_id" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grace_policy_config" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"approvals_enabled" boolean DEFAULT true NOT NULL,
	"auto_escalate_on_emergency" boolean DEFAULT true NOT NULL,
	"confidence_threshold" text DEFAULT '0.7' NOT NULL,
	"high_risk_tools" jsonb DEFAULT '[]'::jsonb,
	"allowed_public_tools" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grace_session" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"channel" "grace_channel" NOT NULL,
	"contact_id" text,
	"started_at" timestamp NOT NULL,
	"ended_at" timestamp,
	"state_json" jsonb,
	"final_summary" text,
	"handoff_reason" text,
	"status" "grace_session_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grace_tool_audit" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"session_id" text NOT NULL,
	"tool_name" text NOT NULL,
	"input_json" jsonb,
	"output_json" jsonb,
	"status" "grace_tool_audit_status" NOT NULL,
	"latency_ms" integer,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"image" text,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now(),
	"credits" jsonb,
	"onboardingDone" boolean DEFAULT false,
	"onboardingData" jsonb,
	"stripeCustomerId" text,
	"stripeSubscriptionId" text,
	"lemonSqueezyCustomerId" text,
	"lemonSqueezySubscriptionId" text,
	"dodoCustomerId" text,
	"dodoSubscriptionId" text,
	"planId" text,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "organization_membership" (
	"organizationId" text NOT NULL,
	"userId" text NOT NULL,
	"role" "role" DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now(),
	CONSTRAINT "organization_membership_organizationId_userId_pk" PRIMARY KEY("organizationId","userId")
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"organizationId" text NOT NULL,
	"role" "role" DEFAULT 'user' NOT NULL,
	"invitedById" text NOT NULL,
	"token" text NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now(),
	CONSTRAINT "invitation_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "account" (
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "account_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId")
);
--> statement-breakpoint
CREATE TABLE "authenticator" (
	"credentialID" text NOT NULL,
	"userId" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"credentialPublicKey" text NOT NULL,
	"counter" integer NOT NULL,
	"credentialDeviceType" text NOT NULL,
	"credentialBackedUp" boolean NOT NULL,
	"transports" text,
	CONSTRAINT "authenticator_userId_credentialID_pk" PRIMARY KEY("userId","credentialID"),
	CONSTRAINT "authenticator_credentialID_unique" UNIQUE("credentialID")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sessionToken" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"password" text,
	"emailVerified" timestamp,
	"image" text,
	"createdAt" timestamp DEFAULT now(),
	CONSTRAINT "app_user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verificationToken" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verificationToken_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"codename" text,
	"default" boolean DEFAULT false,
	"requiredCouponCount" integer,
	"hasOnetimePricing" boolean DEFAULT false,
	"hasMonthlyPricing" boolean DEFAULT false,
	"hasYearlyPricing" boolean DEFAULT false,
	"createdAt" timestamp DEFAULT now(),
	"monthlyPrice" integer,
	"monthlyPriceAnchor" integer,
	"monthlyStripePriceId" text,
	"monthlyLemonSqueezyVariantId" text,
	"monthlyDodoProductId" text,
	"monthlyPaypalPlanId" text,
	"yearlyPrice" integer,
	"yearlyPriceAnchor" integer,
	"yearlyStripePriceId" text,
	"yearlyLemonSqueezyVariantId" text,
	"yearlyDodoProductId" text,
	"yearlyPaypalPlanId" text,
	"onetimePrice" integer,
	"onetimePriceAnchor" integer,
	"onetimeStripePriceId" text,
	"onetimeLemonSqueezyVariantId" text,
	"onetimeDodoProductId" text,
	"onetimePaypalPlanId" text,
	"quotas" jsonb,
	CONSTRAINT "plans_codename_unique" UNIQUE("codename")
);
--> statement-breakpoint
CREATE TABLE "paypal_access_tokens" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paypal_context" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"plan_id" text,
	"user_id" text,
	"organization_id" text,
	"frequency" text NOT NULL,
	"paypal_order_id" text,
	"paypal_subscription_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"purchase_type" text DEFAULT 'plan' NOT NULL,
	"credit_type" text,
	"credit_amount" text
);
--> statement-breakpoint
CREATE TABLE "pipeline_item" (
	"id" text PRIMARY KEY NOT NULL,
	"contact_id" text NOT NULL,
	"stage_id" text NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"priority" "pipeline_priority" DEFAULT 'medium',
	"assignee_id" text,
	"notes" text,
	"last_contact_date" timestamp,
	"next_action_date" timestamp,
	"organization_id" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pipeline_stage" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#6366f1' NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ministry" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"meeting_day" text,
	"meeting_time" text,
	"meeting_location" text,
	"leader_id" text,
	"organization_id" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ministry_member" (
	"id" text PRIMARY KEY NOT NULL,
	"ministry_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"role" "ministry_role" DEFAULT 'member' NOT NULL,
	"joined_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointment" (
	"id" text PRIMARY KEY NOT NULL,
	"contact_id" text,
	"staff_id" text,
	"title" text NOT NULL,
	"date_time" timestamp NOT NULL,
	"duration_minutes" integer DEFAULT 30,
	"status" "appointment_status" DEFAULT 'scheduled' NOT NULL,
	"type" text,
	"notes" text,
	"organization_id" text NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"location" text,
	"is_recurring" boolean DEFAULT false,
	"recurrence_rule" text,
	"organization_id" text NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"assignee_id" text,
	"due_date" timestamp,
	"status" "task_status" DEFAULT 'todo' NOT NULL,
	"priority" "task_priority" DEFAULT 'medium' NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "volunteer_shift" (
	"id" text PRIMARY KEY NOT NULL,
	"volunteer_id" text NOT NULL,
	"event_id" text,
	"date" timestamp NOT NULL,
	"hours" real NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "volunteer" (
	"id" text PRIMARY KEY NOT NULL,
	"contact_id" text NOT NULL,
	"role" text,
	"status" "volunteer_status" DEFAULT 'active' NOT NULL,
	"total_hours" real DEFAULT 0,
	"organization_id" text NOT NULL,
	"joined_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prayer_request" (
	"id" text PRIMARY KEY NOT NULL,
	"contact_id" text,
	"contact_name" text,
	"content" text NOT NULL,
	"urgency" "prayer_urgency" DEFAULT 'normal' NOT NULL,
	"status" "prayer_status" DEFAULT 'new' NOT NULL,
	"assigned_team" text,
	"is_anonymous" text DEFAULT 'false',
	"response" text,
	"organization_id" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_config" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"channel" text NOT NULL,
	"provider" text NOT NULL,
	"mode" "provider_mode" DEFAULT 'agency_managed' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"config_json" jsonb,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_invites" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"organization_id" text NOT NULL,
	"role" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waitlist" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text,
	"twitterAccount" text,
	"email" text,
	"createdAt" timestamp DEFAULT now(),
	CONSTRAINT "waitlist_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "ai_config" ADD CONSTRAINT "ai_config_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "church_contact" ADD CONSTRAINT "church_contact_family_id_family_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."family"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "church_contact" ADD CONSTRAINT "church_contact_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_tag" ADD CONSTRAINT "contact_tag_contact_id_church_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."church_contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family" ADD CONSTRAINT "family_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcast" ADD CONSTRAINT "broadcast_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_contact_id_church_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."church_contact"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_assignee_id_app_user_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."app_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_template" ADD CONSTRAINT "message_template_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon" ADD CONSTRAINT "coupon_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon" ADD CONSTRAINT "coupon_usedByUserId_app_user_id_fk" FOREIGN KEY ("usedByUserId") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_userId_app_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donation" ADD CONSTRAINT "donation_contact_id_church_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."church_contact"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donation" ADD CONSTRAINT "donation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pledge" ADD CONSTRAINT "pledge_contact_id_church_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."church_contact"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pledge" ADD CONSTRAINT "pledge_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grace_approval" ADD CONSTRAINT "grace_approval_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grace_approval" ADD CONSTRAINT "grace_approval_session_id_grace_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."grace_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grace_approval" ADD CONSTRAINT "grace_approval_requested_by_user_id_app_user_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."app_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grace_approval" ADD CONSTRAINT "grace_approval_decided_by_user_id_app_user_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."app_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grace_call" ADD CONSTRAINT "grace_call_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grace_call" ADD CONSTRAINT "grace_call_session_id_grace_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."grace_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grace_call" ADD CONSTRAINT "grace_call_contact_id_church_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."church_contact"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grace_knowledge" ADD CONSTRAINT "grace_knowledge_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grace_message" ADD CONSTRAINT "grace_message_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grace_message" ADD CONSTRAINT "grace_message_session_id_grace_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."grace_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grace_message" ADD CONSTRAINT "grace_message_contact_id_church_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."church_contact"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grace_policy_config" ADD CONSTRAINT "grace_policy_config_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grace_session" ADD CONSTRAINT "grace_session_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grace_session" ADD CONSTRAINT "grace_session_contact_id_church_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."church_contact"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grace_tool_audit" ADD CONSTRAINT "grace_tool_audit_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grace_tool_audit" ADD CONSTRAINT "grace_tool_audit_session_id_grace_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."grace_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_planId_plans_id_fk" FOREIGN KEY ("planId") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_membership" ADD CONSTRAINT "organization_membership_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_membership" ADD CONSTRAINT "organization_membership_userId_app_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_invitedById_app_user_id_fk" FOREIGN KEY ("invitedById") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_app_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authenticator" ADD CONSTRAINT "authenticator_userId_app_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_app_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paypal_context" ADD CONSTRAINT "paypal_context_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paypal_context" ADD CONSTRAINT "paypal_context_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paypal_context" ADD CONSTRAINT "paypal_context_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_item" ADD CONSTRAINT "pipeline_item_contact_id_church_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."church_contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_item" ADD CONSTRAINT "pipeline_item_stage_id_pipeline_stage_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."pipeline_stage"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_item" ADD CONSTRAINT "pipeline_item_assignee_id_app_user_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."app_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_item" ADD CONSTRAINT "pipeline_item_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_stage" ADD CONSTRAINT "pipeline_stage_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ministry" ADD CONSTRAINT "ministry_leader_id_church_contact_id_fk" FOREIGN KEY ("leader_id") REFERENCES "public"."church_contact"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ministry" ADD CONSTRAINT "ministry_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ministry_member" ADD CONSTRAINT "ministry_member_ministry_id_ministry_id_fk" FOREIGN KEY ("ministry_id") REFERENCES "public"."ministry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ministry_member" ADD CONSTRAINT "ministry_member_contact_id_church_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."church_contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_contact_id_church_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."church_contact"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_staff_id_app_user_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."app_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_assignee_id_app_user_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."app_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volunteer_shift" ADD CONSTRAINT "volunteer_shift_volunteer_id_volunteer_id_fk" FOREIGN KEY ("volunteer_id") REFERENCES "public"."volunteer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volunteer_shift" ADD CONSTRAINT "volunteer_shift_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volunteer" ADD CONSTRAINT "volunteer_contact_id_church_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."church_contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volunteer" ADD CONSTRAINT "volunteer_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prayer_request" ADD CONSTRAINT "prayer_request_contact_id_church_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."church_contact"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prayer_request" ADD CONSTRAINT "prayer_request_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_config" ADD CONSTRAINT "provider_config_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invites" ADD CONSTRAINT "organization_invites_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "grace_approval_org_status_idx" ON "grace_approval" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "grace_call_session_idx" ON "grace_call" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "grace_call_org_created_idx" ON "grace_call" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "grace_call_external_id_uq" ON "grace_call" USING btree ("external_call_id");--> statement-breakpoint
CREATE INDEX "grace_knowledge_org_created_idx" ON "grace_knowledge" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "grace_message_session_idx" ON "grace_message" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "grace_message_org_created_idx" ON "grace_message" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "grace_message_provider_id_uq" ON "grace_message" USING btree ("provider_message_id");--> statement-breakpoint
CREATE INDEX "grace_policy_org_idx" ON "grace_policy_config" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "grace_session_org_created_idx" ON "grace_session" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "grace_session_org_status_idx" ON "grace_session" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "grace_tool_audit_org_created_idx" ON "grace_tool_audit" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "grace_tool_audit_session_idx" ON "grace_tool_audit" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "grace_tool_audit_idempotency_uq" ON "grace_tool_audit" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "provider_config_org_channel_idx" ON "provider_config" USING btree ("organization_id","channel");