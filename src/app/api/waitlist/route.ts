import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { waitlist } from "@/db/schema/waitlist";
import { rateLimitKeyed } from "@/lib/grace/channels/webhooks";
import { getClientIp } from "@/lib/security/request";

const waitlistSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  email: z.string().trim().toLowerCase().email("Please enter a valid email"),
  twitterAccount: z.string().trim().max(120).optional(),
});

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    if (!(await rateLimitKeyed(`public:waitlist:${ip}`, 5, 15 * 60_000))) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const json = await request.json();
    const body = waitlistSchema.parse(json);

    await db
      .insert(waitlist)
      .values({
        name: body.name,
        email: body.email,
        twitterAccount: body.twitterAccount || null,
      })
      .onConflictDoNothing({ target: waitlist.email });

    return NextResponse.json(
      { success: true, message: "Successfully joined waitlist" },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
} 
