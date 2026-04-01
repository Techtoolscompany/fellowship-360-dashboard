import { db } from "@/db";
import { churchContacts, graceContactMatchAudit } from "@/db/schema";
import { eq, or, ilike, and } from "drizzle-orm";
import {
  syncContactCreatedToDittofeed,
  syncContactToDittofeedBestEffort,
} from "@/lib/dittofeed/contacts";

export interface ContactInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

export interface MatchResult {
  contactId: string | null;
  confidenceScore: number;
  confidenceTier: "high" | "medium" | "low";
  outcome: "matched_existing" | "created_new" | "created_review_candidate";
  requiresReview: boolean;
}

export async function matchContactForGraceSession(
  organizationId: string,
  sessionId: string,
  input: ContactInput
): Promise<MatchResult> {
  // If no input provided, we can't match or create sensibly. 
  // In a real scenario, an anonymous session might stay unlinked until we get info.
  // For this matching function, we'll assume we at least have *something*.
  if (!input.firstName && !input.lastName && !input.email && !input.phone) {
    return {
      contactId: null,
      confidenceScore: 0,
      confidenceTier: "low",
      outcome: "created_new",
      requiresReview: false,
    };
  }

  // 1. Fetch potential candidates from the DB based on any partial match
  const conditions = [];
  if (input.email) conditions.push(eq(churchContacts.email, input.email));
  if (input.phone) conditions.push(eq(churchContacts.phone, input.phone));
  if (input.firstName) conditions.push(ilike(churchContacts.firstName, input.firstName));
  if (input.lastName) conditions.push(ilike(churchContacts.lastName, input.lastName));

  let candidates: any[] = [];
  if (conditions.length > 0) {
    candidates = await db
      .select()
      .from(churchContacts)
      .where(
        and(
          eq(churchContacts.organizationId, organizationId),
          or(...conditions)
        )
      );
  }

  // 2. Score candidates
  let bestCandidate = null;
  let highestScore = 0;

  for (const candidate of candidates) {
    let score = 0;
    if (input.email && candidate.email?.toLowerCase() === input.email.toLowerCase()) score += 60;
    
    // Normalize phones for comparison (strip non-digits)
    if (input.phone && candidate.phone) {
      const p1 = input.phone.replace(/\D/g, '');
      const p2 = candidate.phone.replace(/\D/g, '');
      if (p1 === p2 && p1.length > 0) score += 60;
    }

    if (input.firstName && candidate.firstName?.toLowerCase() === input.firstName.toLowerCase()) score += 20;
    if (input.lastName && candidate.lastName?.toLowerCase() === input.lastName.toLowerCase()) score += 20;

    if (score > highestScore) {
      highestScore = score;
      bestCandidate = candidate;
    }
  }

  // 3. Determine tier and outcome
  const cappedScore = Math.min(highestScore, 100);
  let tier: "high" | "medium" | "low" = "low";
  let outcome: "matched_existing" | "created_new" | "created_review_candidate" = "created_new";
  let requiresReview = false;
  let finalContactId: string | null = null;

  if (bestCandidate) {
    if (cappedScore >= 80) {
      tier = "high";
      outcome = "matched_existing";
      requiresReview = false;
      finalContactId = bestCandidate.id;
    } else if (cappedScore >= 50) {
      tier = "medium";
      outcome = "matched_existing";
      requiresReview = true;
      finalContactId = bestCandidate.id;
    } else {
      // Score > 0 but < 50 (e.g. just a shared last name, or just a shared first name)
      // Usually better to create new if confidence is this low, to avoid merging unrelated people
      tier = "low";
      outcome = "created_review_candidate";
      requiresReview = true;
    }
  } else {
    // No candidates found at all
    tier = "low";
    outcome = "created_new";
    requiresReview = false;
  }

  // 4. Create new contact if needed
  if (outcome === "created_new" || outcome === "created_review_candidate") {
    const [newContact] = await db.insert(churchContacts).values({
      organizationId,
      firstName: input.firstName || "Unknown",
      lastName: input.lastName || "Unknown",
      email: input.email,
      phone: input.phone,
    }).returning();
    finalContactId = newContact.id;

    await syncContactToDittofeedBestEffort("grace.contacts.matcher.create", () =>
      syncContactCreatedToDittofeed({
        organizationId,
        contact: newContact,
        extraProperties: {
          confidenceTier: tier,
          requiresReview,
        },
      })
    );
  }

  // 5. Audit the match
  await db.insert(graceContactMatchAudit).values({
    organizationId,
    sessionId,
    matchedContactId: outcome === "matched_existing" ? finalContactId : null,
    createdContactId: outcome !== "matched_existing" ? finalContactId : null,
    confidenceScore: cappedScore,
    confidenceTier: tier,
    outcome,
    requiresReview,
    inputJson: input as any,
    candidateJson: candidates.map(c => ({ id: c.id, firstName: c.firstName, lastName: c.lastName, email: c.email, phone: c.phone })),
  });

  return {
    contactId: finalContactId,
    confidenceScore: cappedScore,
    confidenceTier: tier,
    outcome,
    requiresReview
  };
}
