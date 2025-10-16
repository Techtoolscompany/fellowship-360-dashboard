import { NextResponse } from "next/server";
import withSuperAdminAuthRequired from "@/lib/auth/withSuperAdminAuthRequired";
import {
  getOrganizationCredits,
  addCreditTransaction,
} from "@/lib/credits/recalculate";
import { creditTypeSchema } from "@/lib/credits/config";
import { z } from "zod";
import { db } from "@/db";
import { creditTransactions } from "@/db/schema/credits";
import { desc, eq } from "drizzle-orm";

// Schema for adding/deducting credits
const creditActionSchema = z.object({
  action: z.enum(["add", "deduct"]),
  creditType: creditTypeSchema,
  amount: z.number().positive("Amount must be greater than 0"),
  reason: z.string().min(1, "Reason is required"),
});

export const GET = withSuperAdminAuthRequired(async (req, context) => {
  const { id } = (await context.params) as { id: string };
  const { searchParams } = new URL(req.url);

  // Pagination parameters
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "10");
  const offset = (page - 1) * limit;

  try {
    // Get current organization credits
    const currentCredits = await getOrganizationCredits(id);

    // Get credit transactions with pagination
    const allTransactions = await db
      .select()
      .from(creditTransactions)
      .where(eq(creditTransactions.organizationId, id))
      .orderBy(desc(creditTransactions.createdAt))
      .limit(limit)
      .offset(offset);

    const totalTransactions = await db.$count(
      creditTransactions,
      eq(creditTransactions.organizationId, id)
    );

    return NextResponse.json({
      currentCredits,
      transactions: allTransactions,
      pagination: {
        page,
        limit,
        total: totalTransactions,
        totalPages: Math.ceil(totalTransactions / limit),
        hasNext: offset + limit < totalTransactions,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching organization credits:", error);
    return NextResponse.json(
      { error: "Failed to fetch organization credits" },
      { status: 500 }
    );
  }
});

export const POST = withSuperAdminAuthRequired(async (req, context) => {
  const { id } = (await context.params) as { id: string };

  try {
    const body = await req.json();
    const { action, creditType, amount, reason } =
      creditActionSchema.parse(body);

    const user = await context.session.user;
    // Determine transaction type based on action
    const transactionType = action === "add" ? "credit" : "debit";

    // Create metadata with admin info and reason
    const metadata = {
      reason,
      adminAction: true,
      adminId: user.id,
      adminEmail: user.email,
    };

    // Add the credit transaction
    const updatedCredits = await addCreditTransaction(
      id,
      creditType,
      transactionType,
      amount,
      null, // no paymentId for admin actions
      metadata
    );

    return NextResponse.json({
      success: true,
      updatedCredits,
      message: `Successfully ${action === "add" ? "added" : "deducted"} ${amount} ${creditType} credits`,
    });
  } catch (error) {
    console.error("Error managing organization credits:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message.includes("Insufficient")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to manage organization credits" },
      { status: 500 }
    );
  }
});
