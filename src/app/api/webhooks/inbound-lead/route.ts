import { NextResponse } from "next/server";
import { inngest } from "@/lib/inngest/client";
import { db } from "@/db";
import { organizations } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Public Webhook Endpoint to Ingest Leads into the AI Brain.
 * 
 * Example POST request:
 * POST /api/webhooks/inbound-lead
 * Headers: { "Authorization": "Bearer YOUR_ORG_API_KEY" }
 * Body: { 
 *   "contactName": "John Doe",
 *   "contactEmail": "john@example.com",
 *   "message": "I would like to visit this Sunday, what time are services?"
 * }
 */
export async function POST(req: Request) {
  try {
    // 1. Authenticate the request
    // In a real app we'd verify a Bearer token or Webhook Secret.
    // For now, we'll extract the org ID directly if provided, or use a default test one.
    const authHeader = req.headers.get("Authorization");
    
    // NOTE: Replace this with real API key validation later
    let organizationId = "demo_org_id"; 
    
    if (authHeader && authHeader.startsWith("Bearer ")) {
       // Optional: validate token here
       organizationId = authHeader.split(" ")[1];
    } else {
        // Fallback for fast local testing: grab the first organization in the DB
        const [firstOrg] = await db.select().from(organizations).limit(1);
        if (!firstOrg) {
            return NextResponse.json({ error: "No organizations exist in the database to receive this lead." }, { status: 400 });
        }
        organizationId = firstOrg.id;
    }

    // 2. Parse the incoming lead data
    const body = await req.json();
    const { contactName, contactEmail, message } = body;

    if (!contactName || !contactEmail || !message) {
      return NextResponse.json(
        { error: "Missing required fields: contactName, contactEmail, message" },
        { status: 400 }
      );
    }

    // 3. Fire the Inngest Event (The "AI Brain")
    // This returns instantly. The AI logic runs asynchronously in the background.
    await inngest.send({
      name: "ai/process-website-lead",
      data: {
        organizationId,
        contactName,
        contactEmail,
        message,
      },
    });

    // 4. Return immediately to the caller
    return NextResponse.json({
      success: true,
      message: "Lead received and dispatched to AI Brain for processing.",
    });

  } catch (error: any) {
    console.error("Error processing inbound lead webhook:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
