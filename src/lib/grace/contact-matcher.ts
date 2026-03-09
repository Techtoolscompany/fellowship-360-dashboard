/**
 * Confidence-tiered contact matching for Grace sessions.
 *
 * Given caller-provided identifiers (phone, email, name) this module:
 *   1. Queries existing church_contacts within the org
 *   2. Scores each candidate on exact + fuzzy dimensions
 *   3. Applies tier thresholds:
 *        high   (≥80) → auto-match
 *        medium (40-79) → create + flag for staff review
 *        low    (<40) → create new contact
 *   4. Writes an audit record to grace_contact_match_audit
 *   5. Updates the grace_session with the match result
 */

import { db } from "@/db";
import { churchContacts } from "@/db/schema/church-contacts";
import { graceSessions } from "@/db/schema/grace-sessions";
import { graceContactMatchAudit } from "@/db/schema/grace-contact-match-audit";
import { and, eq, or, ilike, sql } from "drizzle-orm";
import type { GraceMatchTier } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContactMatchInput {
  organizationId: string;
  sessionId: string;
  phone?: string | null;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

interface ScoredCandidate {
  contactId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  score: number;
  reasons: string[];
}

export interface ContactMatchResult {
  tier: GraceMatchTier;
  contactId: string;
  isNewContact: boolean;
  requiresReview: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIER_HIGH_THRESHOLD = 80;
const TIER_MEDIUM_THRESHOLD = 40;

// ---------------------------------------------------------------------------
// Normalisation helpers
// ---------------------------------------------------------------------------

function normalizePhone(raw?: string | null): string {
  if (!raw) return "";
  return raw.replace(/\D/g, "").slice(-10); // last 10 digits
}

function normalizeStr(raw?: string | null): string {
  return (raw ?? "").trim().toLowerCase();
}

/**
 * Simple Levenshtein-inspired similarity ratio (0-1).
 * Sufficient for name comparison without heavy deps.
 */
function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const la = a.toLowerCase();
  const lb = b.toLowerCase();
  if (la === lb) return 1;

  const len = Math.max(la.length, lb.length);
  if (len === 0) return 1;

  // Compute edit distance (simple Wagner-Fischer)
  const matrix: number[][] = [];
  for (let i = 0; i <= la.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= lb.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= la.length; i++) {
    for (let j = 1; j <= lb.length; j++) {
      const cost = la[i - 1] === lb[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return 1 - matrix[la.length][lb.length] / len;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

function scoreCandidate(
  candidate: { firstName: string; lastName: string; email: string | null; phone: string | null },
  input: ContactMatchInput
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // Exact phone match (strongest signal)
  const inputPhone = normalizePhone(input.phone);
  const candidatePhone = normalizePhone(candidate.phone);
  if (inputPhone && candidatePhone && inputPhone === candidatePhone) {
    score += 45;
    reasons.push("phone_exact");
  }

  // Exact email match
  const inputEmail = normalizeStr(input.email);
  const candidateEmail = normalizeStr(candidate.email);
  if (inputEmail && candidateEmail && inputEmail === candidateEmail) {
    score += 40;
    reasons.push("email_exact");
  }

  // Name similarity
  const firstSim = similarity(input.firstName ?? "", candidate.firstName);
  const lastSim = similarity(input.lastName ?? "", candidate.lastName);

  if (firstSim >= 0.85 && lastSim >= 0.85) {
    score += 15;
    reasons.push("name_strong_match");
  } else if (firstSim >= 0.6 && lastSim >= 0.6) {
    score += 8;
    reasons.push("name_partial_match");
  } else if (lastSim >= 0.85) {
    score += 5;
    reasons.push("last_name_match");
  }

  return { score: Math.min(score, 100), reasons };
}

// ---------------------------------------------------------------------------
// Core match function
// ---------------------------------------------------------------------------

export async function matchOrCreateContact(
  input: ContactMatchInput
): Promise<ContactMatchResult> {
  const { organizationId, sessionId } = input;

  // Build WHERE conditions for candidate lookup
  const conditions: ReturnType<typeof eq>[] = [];
  if (input.phone) {
    const norm = normalizePhone(input.phone);
    if (norm.length >= 7) {
      // Match last N digits via SQL to handle formatting differences
      conditions.push(
        sql`regexp_replace(${churchContacts.phone}, '[^0-9]', '', 'g') LIKE ${"%" + norm}`
      );
    }
  }
  if (input.email) {
    conditions.push(ilike(churchContacts.email, input.email.trim()));
  }
  if (input.lastName) {
    conditions.push(ilike(churchContacts.lastName, input.lastName.trim()));
  }

  // Pull candidates
  let candidates: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
  }[] = [];

  if (conditions.length > 0) {
    candidates = await db
      .select({
        id: churchContacts.id,
        firstName: churchContacts.firstName,
        lastName: churchContacts.lastName,
        email: churchContacts.email,
        phone: churchContacts.phone,
      })
      .from(churchContacts)
      .where(
        and(eq(churchContacts.organizationId, organizationId), or(...conditions))
      )
      .limit(25);
  }

  // Score candidates
  const scored: ScoredCandidate[] = candidates
    .map((c) => {
      const { score, reasons } = scoreCandidate(c, input);
      return {
        contactId: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        phone: c.phone,
        score,
        reasons,
      };
    })
    .sort((a, b) => b.score - a.score);

  const best = scored[0];

  // Determine tier
  let tier: GraceMatchTier;
  let contactId: string;
  let isNewContact = false;
  let requiresReview = false;
  let outcome: "matched_existing" | "created_new" | "created_review_candidate";

  if (best && best.score >= TIER_HIGH_THRESHOLD) {
    // ── HIGH confidence → auto-match ──
    tier = "high";
    contactId = best.contactId;
    outcome = "matched_existing";
  } else if (best && best.score >= TIER_MEDIUM_THRESHOLD) {
    // ── MEDIUM confidence → create new + flag for review ──
    tier = "medium";
    requiresReview = true;
    const [newContact] = await db
      .insert(churchContacts)
      .values({
        organizationId,
        firstName: input.firstName ?? "Unknown",
        lastName: input.lastName ?? "Caller",
        email: input.email ?? undefined,
        phone: input.phone ?? undefined,
        memberStatus: "visitor",
        source: "other",
      })
      .returning({ id: churchContacts.id });
    contactId = newContact.id;
    isNewContact = true;
    outcome = "created_review_candidate";
  } else {
    // ── LOW confidence → create new contact ──
    tier = "low";
    const [newContact] = await db
      .insert(churchContacts)
      .values({
        organizationId,
        firstName: input.firstName ?? "Unknown",
        lastName: input.lastName ?? "Caller",
        email: input.email ?? undefined,
        phone: input.phone ?? undefined,
        memberStatus: "visitor",
        source: "other",
      })
      .returning({ id: churchContacts.id });
    contactId = newContact.id;
    isNewContact = true;
    outcome = "created_new";
  }

  // Update session with match result
  await db
    .update(graceSessions)
    .set({
      matchedContactId: contactId,
      matchConfidence: tier,
      requiresReview,
      updatedAt: new Date(),
    })
    .where(eq(graceSessions.id, sessionId));

  // Write audit record
  await db.insert(graceContactMatchAudit).values({
    organizationId,
    sessionId,
    matchedContactId: best && best.score >= TIER_HIGH_THRESHOLD ? best.contactId : null,
    createdContactId: isNewContact ? contactId : null,
    confidenceScore: best?.score ?? 0,
    confidenceTier: tier,
    outcome,
    requiresReview,
    inputJson: {
      phone: input.phone ?? null,
      email: input.email ?? null,
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
    },
    candidateJson: scored.slice(0, 5).map((c) => ({
      contactId: c.contactId,
      score: c.score,
      reasons: c.reasons,
    })),
  });

  return { tier, contactId, isNewContact, requiresReview };
}
