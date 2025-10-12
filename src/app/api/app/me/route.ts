import withAuthRequired from "@/lib/auth/withAuthRequired";
import { NextResponse } from "next/server";
import { MeResponse } from "./types";
import { db } from "@/db";
import { users } from "@/db/schema/user";
import { eq } from "drizzle-orm";
import { z } from "zod";

const updateUserSchema = z.object({
  name: z.string().min(2),
  image: z.string().optional(),
});

export const GET = withAuthRequired(async (req, context) => {
  const { session } = context;

  return NextResponse.json<MeResponse>({
    user: await session.user,
  });
});

export const PATCH = withAuthRequired(async (req, context) => {
  const { session } = context;
  const body = await req.json();

  const validatedData = updateUserSchema.parse(body);
  const user = await session.user;

  const updatedUser = await db
    .update(users)
    .set({
      name: validatedData.name,
      image: validatedData.image,
    })
    .where(eq(users.id, user.id))
    .returning();

  return NextResponse.json(updatedUser[0]);
});

// TODO: Implement actual account deletion logic
export const DELETE = withAuthRequired(async () => {
  // For now, just return a success response
  return NextResponse.json({ success: true });
});
