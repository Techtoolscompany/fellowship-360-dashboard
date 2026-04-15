# Fellowship 360 - Production Runbook

This document outlines the standard operating procedures for taking Fellowship 360 live and handling production incidents.

## 🚨 1. Sentry & Alerts Configuration

Sentry is pre-configured via the Next.js SDK (`sentry.client.config.ts`, `sentry.server.config.ts`, and `sentry.edge.config.ts`).

### Activation Steps

1. Ensure the `NEXT_PUBLIC_SENTRY_DSN` environment variable is set in Vercel/production.
2. In your Sentry project dashboard, set up the following **Alert Rules**:
   - **High Traffic Anomalies**: Trigger if Error Count > 10 in 5 minutes.
   - **Webhook Failures**: Trigger alerted specifically for routes matching `*/api/webhooks/*` and `*/api/sms-gateway/*`.
   - **Inngest Workflow Failures**: Monitor Inngest's dashboard alerts or filter Sentry for `Inngest` context.

## 📉 2. Webhook Failure Monitoring

Fellowship 360 relies heavily on webhooks from Stripe, TextBee, Retell, and ElevenLabs. High availability of these endpoints is vital.

### Monitoring Tactics

1. **Sentry Search**: Use the Sentry query `transaction: "/api/webhooks/*" AND level: error` to spot dropped webhooks.
2. **Delivery Signatures**: Webhook signatures are checked securely. A spike in validation errors (401 Unauthorized from `verify-signature.ts`) might mean your webhook secrets rotated or an attacker is scanning.
3. **Inngest Event Logs**: Monitor the `org.created.v1` event in the Inngest UI to ensure new tenants have their providers auto-provisioned correctly. If `provisionOrgProviders` fails, SMS and AI defaults won't be assigned.

### TextBee (SMS) Gateway Health

- **Last Seen**: Check the Super Admin -> "SMS Devices" tab. If an Android device misses its ping for over 1 hour, its FCM token might have rotated or the phone is offline.
- **Failures**: The `sms_messages` table logs outbound/inbound. A `failed` status indicates FCM failed or the device failed to broadcast via cellular.

## 🔄 3. Production Rollback Strategy

In the event of a catastrophic app failure post-deployment.

### Vercel Code Rollback

1. Open the [Vercel Dashboard] for the project.
2. Navigate to **Deployments**.
3. Find the last known stable deployment.
4. Click the three dots -> **Promote to Production** (or Instant Rollback).

### Database (Drizzle) Rollback

Avoid breaking schema changes unless necessary. If a migration needs reverting:

1. `npm run db:push` is destructive if tables are dropped.
2. If reverting tables, write a DOWN migration or restore from the latest Neon DB Point-in-Time Recovery (PITR) backup branch if data corruption occurred.
3. Once the database is restored in Neon, deploy the code matching that schema.

## ✅ Daily Launch Checklist Checks

- Start with `docs/PREFLIGHT_CLEARANCE_CHECKLIST.md` and keep it green.
- [ ] Database migrated successfully (Migrations `0005` to `0009` included).
- [ ] `.env` keys populated for Gemini, Stripe, FCM (`FCM_SERVER_URL`, `FCM_SERVER_KEY`), and webhook secrets.
- [ ] Vercel Environment Variables matches local `.env` required keys.
