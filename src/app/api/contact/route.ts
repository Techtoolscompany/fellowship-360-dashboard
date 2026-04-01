import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { contacts } from "@/db/schema/contact";
import { rateLimitKeyed } from "@/lib/grace/channels/webhooks";
import { getClientIp } from "@/lib/security/request";

const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  company: z.string().trim().max(160).optional(),
  message: z.string().trim().min(10).max(5000),
});

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    if (!(await rateLimitKeyed(`public:contact:${ip}`, 5, 15 * 60_000))) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const json = await request.json();
    const body = contactSchema.parse(json);

    await db.insert(contacts).values({
      name: body.name,
      email: body.email,
      company: body.company,
      message: body.message,
    });

    return NextResponse.json(
      { success: true, message: "Message received" },
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
