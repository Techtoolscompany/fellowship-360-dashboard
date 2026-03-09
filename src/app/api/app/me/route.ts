import withAuthRequired from "@/lib/auth/withAuthRequired";
import { NextResponse } from "next/server";
import { MeResponse } from "./types";
import { db } from "@/db";
import { users } from "@/db/schema/user";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { coupons } from "@/db/schema/coupons";
import { paypalContext } from "@/db/schema/paypal";

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

export const DELETE = withAuthRequired(async (req, context) => {
  const { session } = context;
  const user = await session.user;

  const deleted = await db.transaction(async (tx) => {
    await tx
      .update(paypalContext)
      .set({ userId: null })
      .where(eq(paypalContext.userId, user.id));

    await tx
      .update(coupons)
      .set({ usedByUserId: null })
      .where(eq(coupons.usedByUserId, user.id));

    const rows = await tx
      .delete(users)
      .where(eq(users.id, user.id))
      .returning({ id: users.id });

    return rows[0] ?? null;
  });

  if (!deleted) {
    return NextResponse.json({ success: false, message: "User not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
});
