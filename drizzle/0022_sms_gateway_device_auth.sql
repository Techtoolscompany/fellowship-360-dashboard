ALTER TABLE "sms_devices" ADD COLUMN "auth_token_id" text;--> statement-breakpoint
ALTER TABLE "sms_devices" ADD COLUMN "auth_token_hash" text;--> statement-breakpoint
ALTER TABLE "sms_devices" ADD COLUMN "auth_token_issued_at" timestamp;--> statement-breakpoint
ALTER TABLE "sms_devices" ADD COLUMN "auth_token_last_used_at" timestamp;--> statement-breakpoint
ALTER TABLE "sms_devices" ADD COLUMN "auth_token_revoked_at" timestamp;--> statement-breakpoint
ALTER TABLE "sms_devices" ADD COLUMN "enrolled_at" timestamp;--> statement-breakpoint
ALTER TABLE "sms_devices" ADD COLUMN "status_json" jsonb;--> statement-breakpoint
CREATE TABLE "sms_device_enrollment_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"device_id" text NOT NULL,
	"organization_id" text,
	"token_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"consumed_at" timestamp,
	"metadata_json" jsonb,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sms_device_enrollment_tokens" ADD CONSTRAINT "sms_device_enrollment_tokens_device_id_sms_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."sms_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_device_enrollment_tokens" ADD CONSTRAINT "sms_device_enrollment_tokens_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sms_devices_auth_token_id_uidx" ON "sms_devices" USING btree ("auth_token_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sms_device_enrollment_tokens_token_id_uidx" ON "sms_device_enrollment_tokens" USING btree ("token_id");--> statement-breakpoint
ALTER TABLE "sms_messages" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX "sms_messages_outbound_idempotency_recipient_uidx" ON "sms_messages" USING btree ("organization_id","direction","idempotency_key","to_number");
