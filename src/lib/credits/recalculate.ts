import { db } from "@/db";
import { CreditTransaction, creditTransactions } from "@/db/schema/credits";
import { eq } from "drizzle-orm";
import { type CreditType } from "./credits";
import { organizations } from "@/db/schema/organization";

type CreditRecord = {
  [K in CreditType]?: number;
};

/**
 * Recalculates organization credits based on all credit transactions
 * @param organizationId - The organization ID to recalculate credits for
 * @returns Promise<CreditRecord> - The updated credit balances
 */
export async function recalculateOrganizationCredits(
  organizationId: string
): Promise<CreditRecord> {
  try {
    // Get all credit transactions for the organization
    const transactions = await db
      .select()
      .from(creditTransactions)
      .where(eq(creditTransactions.organizationId, organizationId))
      .orderBy(creditTransactions.createdAt);

    // Calculate balances for each credit type
    const creditBalances: CreditRecord = {};

    for (const transaction of transactions) {
      const { creditType, transactionType, amount } = transaction;

      // Initialize credit type if not exists
      if (!creditBalances[creditType]) {
        creditBalances[creditType] = 0;
      }

      // Apply transaction based on type
      switch (transactionType) {
        case "credit":
          // Add credits
          creditBalances[creditType]! += amount;
          break;
        case "debit":
          // Subtract credits (amount is stored as positive)
          creditBalances[creditType]! -= amount;
          break;
        case "expired":
          // Subtract expired credits (amount is stored as positive)
          creditBalances[creditType]! -= amount;
          break;
      }
    }

    // Update organization's credits field
    await db
      .update(organizations)
      .set({ credits: creditBalances })
      .where(eq(organizations.id, organizationId));

    return creditBalances;
  } catch (error) {
    console.error("Error recalculating organization credits:", error);
    throw new Error(
      `Failed to recalculate credits for organization ${organizationId}`
    );
  }
}

/**
 * Adds a credit transaction and updates organization balance directly
 * @param organizationId - Organization ID
 * @param creditType - Type of credit
 * @param transactionType - Type of transaction (credit, debit, expired)
 * @param amount - Amount of credits (always positive)
 * @param paymentId - Optional payment ID for duplicate prevention
 * @param metadata - Optional metadata
 * @param expirationDate - Optional expiration date for the credits
 * @returns Promise<CreditRecord> - Updated credit balances
 *
 * @example
 * // Add 100 image generation credits with payment ID and expiration
 * await addCreditTransaction("organization123", "image_generation", "credit", 100, "payment_123", {
 *   reason: "Purchase",
 *   orderId: "order_123"
 * }, new Date('2024-12-31'));
 *
 * // Use 5 image generation credits
 * await addCreditTransaction("organization123", "image_generation", "debit", 5, null, {
 *   reason: "Image generated"
 * });
 *
 * // Expire 10 video generation credits
 * await addCreditTransaction("organization123", "video_generation", "expired", 10, null, {
 *   reason: "Credits expired after 30 days"
 * });
 */
export async function addCreditTransaction(
  organizationId: string,
  creditType: CreditType,
  transactionType: "credit" | "debit" | "expired",
  amount: number,
  paymentId?: string | null,
  metadata?: CreditTransaction["metadata"],
  expirationDate?: Date | null
): Promise<CreditRecord> {
  try {
    // Validate amount is positive
    if (amount <= 0) {
      throw new Error("Credit amount must be positive");
    }

    // Check for duplicate paymentId if provided
    if (paymentId) {
      const existingTransaction = await db
        .select({ id: creditTransactions.id })
        .from(creditTransactions)
        .where(eq(creditTransactions.paymentId, paymentId))
        .limit(1);

      if (existingTransaction.length > 0) {
        throw new Error(
          `Transaction with paymentId ${paymentId} already exists`
        );
      }
    }

    // Get current organization credits
    const currentOrganization = await db
      .select({ credits: organizations.credits })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (!currentOrganization.length) {
      throw new Error(`Organization ${organizationId} not found`);
    }

    const currentCredits: CreditRecord = currentOrganization[0].credits || {};

    // Initialize credit type if not exists
    if (!currentCredits[creditType]) {
      currentCredits[creditType] = 0;
    }

    // Calculate new balance based on transaction type
    let newBalance = currentCredits[creditType]!;
    switch (transactionType) {
      case "credit":
        newBalance += amount;
        break;
      case "debit":
      case "expired":
        newBalance -= amount;
        // Do not care about negative balance as bans can cause this
        break;
    }

    // Update the credits in the organization record
    const updatedCredits = { ...currentCredits, [creditType]: newBalance };

    // Insert the transaction record
    await db.insert(creditTransactions).values({
      organizationId,
      creditType,
      transactionType,
      amount,
      paymentId,
      metadata,
      expirationDate,
    });

    // Update organization's credits
    await db
      .update(organizations)
      .set({ credits: updatedCredits })
      .where(eq(organizations.id, organizationId));

    return updatedCredits;
  } catch (error) {
    console.error("Error adding credit transaction:", error);
    throw new Error(
      `Failed to add credit transaction for organization ${organizationId}: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Gets current credit balance for a organization without recalculating
 * @param organizationId - Organization ID
 * @returns Promise<CreditRecord> - Current credit balances from organization table
 */
export async function getOrganizationCredits(
  organizationId: string
): Promise<CreditRecord> {
  try {
    const organization = await db
      .select({ credits: organizations.credits })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    return organization[0]?.credits || {};
  } catch (error) {
    console.error("Error getting organization credits:", error);
    throw new Error(`Failed to get credits for organization ${organizationId}`);
  }
}

/**
 * Adds credits to a organization's account with duplicate prevention
 * @param organizationId - Organization ID
 * @param creditType - Type of credit
 * @param amount - Amount of credits to add
 * @param paymentId - Payment ID for duplicate prevention
 * @param metadata - Optional metadata
 * @param expirationDate - Optional expiration date for the credits
 * @returns Promise<CreditRecord> - Updated credit balances
 */
export async function addCredits(
  organizationId: string,
  creditType: CreditType,
  amount: number,
  paymentId: string,
  metadata?: CreditTransaction["metadata"],
  expirationDate?: Date | null
): Promise<CreditRecord> {
  return await addCreditTransaction(
    organizationId,
    creditType,
    "credit",
    amount,
    paymentId,
    metadata,
    expirationDate
  );
}

/**
 * Deducts credits from a organization's account (with balance check)
 * @param organizationId - Organization ID
 * @param creditType - Type of credit
 * @param amount - Amount of credits to deduct
 * @param metadata - Optional metadata
 * @returns Promise<CreditRecord> - Updated credit balances
 * @throws Error if insufficient credits
 */
export async function deductCredits(
  organizationId: string,
  creditType: CreditType,
  amount: number,
  metadata?: CreditTransaction["metadata"]
): Promise<CreditRecord> {
  // Check if organization has sufficient credits
  const currentCredits = await getOrganizationCredits(organizationId);
  const availableCredits = currentCredits[creditType] || 0;

  if (availableCredits < amount) {
    throw new Error(
      `Insufficient ${creditType} credits. Available: ${availableCredits}, Required: ${amount}`
    );
  }

  return await addCreditTransaction(
    organizationId,
    creditType,
    "debit",
    amount,
    null,
    metadata
  );
}
