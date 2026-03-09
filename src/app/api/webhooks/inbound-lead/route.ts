import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/lib/inngest/client";
import { INNGEST_EVENTS, buildLeadReceivedIdempotencyKey } from "@/lib/inngest/events";
import { db } from "@/db";
import { organizations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { rateLimitKeyed, verifyWebhookSignature } from "@/lib/grace/channels/webhooks";

/**
 * Public webhook to ingest leads into the Grace AI pipeline.
 * Authentication uses HMAC signature in `x-grace-signature`.
 *
 * POST /api/webhooks/inbound-lead
 * Headers: { "x-grace-signature": "<hex-hmac>" }
 * Body: {
 *   "organizationId": "...",
 *   "contactName": "...",
 *   "contactEmail": "...",
 *   "message": "..."
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const secret = process.env.GRACE_INBOUND_LEAD_WEBHOOK_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: "Inbound lead webhook secret is not configured." },
        { status: 503 }
      );
    }

    const rawBody = await req.text();
    const signature = req.headers.get("x-grace-signature");
    const validSignature = verifyWebhookSignature(rawBody, signature, secret);
    if (!validSignature) {
      return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
    }

    const key = `${req.headers.get("x-forwarded-for") || "unknown"}:inbound-lead`;
    if (!(await rateLimitKeyed(key, 60, 60_000))) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429 });
    }

    const body = JSON.parse(rawBody) as {
      organizationId?: string;
      contactName?: string;
      contactEmail?: string;
      message?: string;
    };

    const { organizationId, contactName, contactEmail, message } = body;

    if (!organizationId || !contactName || !contactEmail || !message) {
      return NextResponse.json(
        { error: "Missing required fields: organizationId, contactName, contactEmail, message" },
        { status: 400 }
      );
    }

    // Verify the org exists — prevents fabricated org IDs from being accepted.
    const [org] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (!org) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const idempotencyKey = buildLeadReceivedIdempotencyKey({
      organizationId: org.id,
      contactEmail,
      message,
    });

    await inngest.send({
      id: idempotencyKey,
      name: INNGEST_EVENTS.GRACE_LEAD_RECEIVED,
      data: {
        organizationId: org.id,
        contactName,
        contactEmail,
        message,
        idempotencyKey,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Lead received and queued for processing.",
    });
  } catch (error) {
    console.error("Error processing inbound lead webhook:", error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
