ALTER TABLE "ai_config"
ADD COLUMN IF NOT EXISTS "proactive_mode" text DEFAULT 'normal' NOT NULL;

UPDATE "grace_policy_config"
SET
  "high_risk_tools" = '[]'::jsonb,
  "updated_at" = NOW()
WHERE COALESCE("high_risk_tools", '[]'::jsonb) =
  '["messages.sendSMS","messages.sendEmail","appointments.book","contacts.upsert"]'::jsonb;
