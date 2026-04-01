import { createHash, randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, inArray, sql } from "drizzle-orm";
import withOrganizationAuthRequired from "@/lib/auth/withOrganizationAuthRequired";
import { OrganizationRole } from "@/db/schema/organization";
import { db } from "@/db";
import { churchContacts, graceApprovals, graceSessions } from "@/db/schema";
import { executePlannedActions } from "@/lib/grace/router/executor";
import { sendOrganizationSms } from "@/lib/sms-gateway/send";
import type { ProposedAction } from "@/lib/grace/types";

const payloadSchema = z.object({
  sessionId: z.string(),
  actionIds: z.array(z.string()).min(1),
  mfaCode: z.string().trim().min(4).max(10).optional(),
});

const MFA_NOTE_KIND = "grace_approval_mfa_v1";
const MFA_TTL_MS = 10 * 60 * 1000;
const MFA_MAX_ATTEMPTS = 5;

type ApprovalMfaState = {
  kind: typeof MFA_NOTE_KIND;
  sessionId: string;
  initiatedByUserId: string;
  sentTo: string;
  maskedTo: string;
  codeHash: string;
  sentAt: string;
  expiresAt: string;
  attemptCount: number;
  verifiedAt?: string | null;
};

function normalizePhoneForSms(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1).replace(/\D/g, "");
    return digits.length >= 8 ? `+${digits}` : null;
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return digits.length >= 8 ? `+${digits}` : null;
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 4) return phone;
  return `***-***-${digits.slice(-4)}`;
}

function hashMfaCode(sessionId: string, code: string): string {
  const secret =
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "grace-approval-mfa-fallback-secret";
  return createHash("sha256")
    .update(`${sessionId}:${code}:${secret}`)
    .digest("hex");
}

function parseMfaState(decisionNote: string | null): ApprovalMfaState | null {
  if (!decisionNote) return null;
  try {
    const parsed = JSON.parse(decisionNote) as Partial<ApprovalMfaState>;
    if (
      parsed.kind !== MFA_NOTE_KIND ||
      typeof parsed.sessionId !== "string" ||
      typeof parsed.initiatedByUserId !== "string" ||
      typeof parsed.sentTo !== "string" ||
      typeof parsed.maskedTo !== "string" ||
      typeof parsed.codeHash !== "string" ||
      typeof parsed.sentAt !== "string" ||
      typeof parsed.expiresAt !== "string" ||
      typeof parsed.attemptCount !== "number"
    ) {
      return null;
    }
    return parsed as ApprovalMfaState;
  } catch {
    return null;
  }
}

async function resolveApproverPhone(organizationId: string, email: string | null | undefined) {
  if (!email) return null;
  const loweredEmail = email.trim().toLowerCase();
  if (!loweredEmail) return null;

  const [contact] = await db
    .select({ phone: churchContacts.phone })
    .from(churchContacts)
    .where(
      and(
        eq(churchContacts.organizationId, organizationId),
        sql`lower(${churchContacts.email}) = ${loweredEmail}`
      )
    )
    .limit(1);

  return normalizePhoneForSms(contact?.phone ?? null);
}

function challengeExpired(state: ApprovalMfaState, nowMs: number): boolean {
  return Number.isNaN(Date.parse(state.expiresAt)) || Date.parse(state.expiresAt) <= nowMs;
}

function challengeActiveForUser(
  state: ApprovalMfaState | null,
  sessionId: string,
  userId: string,
  nowMs: number
): state is ApprovalMfaState {
  if (!state) return false;
  if (state.kind !== MFA_NOTE_KIND) return false;
  if (state.sessionId !== sessionId) return false;
  if (state.initiatedByUserId !== userId) return false;
  if (challengeExpired(state, nowMs)) return false;
  return true;
}

export const POST = withOrganizationAuthRequired(async (req, context) => {
  try {
    const body = payloadSchema.parse(await req.json());
    const org = await context.session.organization;
    const user = await context.session.user;

    const [session] = await db
      .select()
      .from(graceSessions)
      .where(and(eq(graceSessions.id, body.sessionId), eq(graceSessions.organizationId, org.id)))
      .limit(1);

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const approvals = await db
      .select()
      .from(graceApprovals)
      .where(
        and(
          eq(graceApprovals.organizationId, org.id),
          eq(graceApprovals.sessionId, body.sessionId),
          inArray(graceApprovals.id, body.actionIds),
          eq(graceApprovals.status, "pending")
        )
      );

    if (approvals.length === 0) {
      return NextResponse.json(
        { error: "No pending approvals found for requested actions" },
        { status: 404 }
      );
    }

    const stepUpRequired = session.actorType !== "staff";
    if (stepUpRequired) {
      const nowMs = Date.now();
      const existingState = parseMfaState(approvals[0].decisionNote);
      const activeState = challengeActiveForUser(
        existingState,
        session.id,
        user.id,
        nowMs
      )
        ? existingState
        : null;
      const alreadyVerified = Boolean(activeState?.verifiedAt);

      if (!alreadyVerified) {
        if (!body.mfaCode) {
          let stateToUse = activeState;

          if (!stateToUse) {
            const approverPhone = await resolveApproverPhone(org.id, user.email);
            if (!approverPhone) {
              return NextResponse.json(
                {
                  error:
                    "MFA phone not found for approver. Add a contact in CRM with your user email and phone number.",
                },
                { status: 412 }
              );
            }

            const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
            const sentAtIso = new Date(nowMs).toISOString();
            const expiresAtIso = new Date(nowMs + MFA_TTL_MS).toISOString();
            const nextState: ApprovalMfaState = {
              kind: MFA_NOTE_KIND,
              sessionId: session.id,
              initiatedByUserId: user.id,
              sentTo: approverPhone,
              maskedTo: maskPhone(approverPhone),
              codeHash: hashMfaCode(session.id, code),
              sentAt: sentAtIso,
              expiresAt: expiresAtIso,
              attemptCount: 0,
              verifiedAt: null,
            };

            const message = [
              "Grace approval verification code",
              code,
              "Expires in 10 minutes.",
              "If you did not request this, ignore this message.",
            ].join("\n");

            const smsResult = await sendOrganizationSms({
              organizationId: org.id,
              to: approverPhone,
              message,
              idempotencyKey: `grace-mfa:${org.id}:${session.id}:${sentAtIso}`,
            });

            if (!smsResult.success) {
              return NextResponse.json(
                { error: smsResult.error ?? "Failed to send MFA verification code." },
                { status: 502 }
              );
            }

            await db
              .update(graceApprovals)
              .set({ decisionNote: JSON.stringify(nextState) })
              .where(
                and(
                  eq(graceApprovals.organizationId, org.id),
                  eq(graceApprovals.sessionId, session.id),
                  eq(graceApprovals.status, "pending")
                )
              );

            stateToUse = nextState;
          }

          return NextResponse.json(
            {
              error: "MFA verification code required.",
              mfaRequired: true,
              method: "sms",
              maskedDestination: stateToUse.maskedTo,
              expiresAt: stateToUse.expiresAt,
            },
            { status: 428 }
          );
        }

        const submittedCode = body.mfaCode.trim();
        if (!/^\d{6}$/.test(submittedCode)) {
          return NextResponse.json(
            { error: "MFA code must be a 6-digit number.", mfaRequired: true },
            { status: 400 }
          );
        }

        const challenge = challengeActiveForUser(existingState, session.id, user.id, nowMs)
          ? existingState
          : null;

        if (!challenge) {
          return NextResponse.json(
            { error: "MFA challenge expired or missing. Request a new verification code.", mfaRequired: true },
            { status: 428 }
          );
        }

        if (challenge.attemptCount >= MFA_MAX_ATTEMPTS) {
          return NextResponse.json(
            { error: "Too many invalid MFA attempts. Request a new verification code.", mfaRequired: true },
            { status: 429 }
          );
        }

        const submittedHash = hashMfaCode(session.id, submittedCode);
        if (submittedHash !== challenge.codeHash) {
          const updatedState = {
            ...challenge,
            attemptCount: challenge.attemptCount + 1,
          };

          await db
            .update(graceApprovals)
            .set({ decisionNote: JSON.stringify(updatedState) })
            .where(
              and(
                eq(graceApprovals.organizationId, org.id),
                eq(graceApprovals.sessionId, session.id),
                eq(graceApprovals.status, "pending")
              )
            );

          return NextResponse.json(
            {
              error: "Invalid MFA code.",
              mfaRequired: true,
              attemptsRemaining: Math.max(MFA_MAX_ATTEMPTS - updatedState.attemptCount, 0),
              maskedDestination: challenge.maskedTo,
              expiresAt: challenge.expiresAt,
            },
            { status: 401 }
          );
        }

        const verifiedState = {
          ...challenge,
          verifiedAt: new Date(nowMs).toISOString(),
        };

        await db
          .update(graceApprovals)
          .set({ decisionNote: JSON.stringify(verifiedState) })
          .where(
            and(
              eq(graceApprovals.organizationId, org.id),
              eq(graceApprovals.sessionId, session.id),
              eq(graceApprovals.status, "pending")
            )
          );
      }
    }

    const actions = approvals.map((approval) =>
      approval.proposedAction as unknown as ProposedAction
    );

    const execution = await executePlannedActions({
      actions,
      context: {
        organizationId: org.id,
        sessionId: session.id,
        channel: session.channel,
        actorType: session.actorType,
        userId: user.id,
        contactId: session.contactId,
      },
      skipApprovals: true,
    });

    await db
      .update(graceApprovals)
      .set({
        status: "approved",
        decidedByUserId: user.id,
        decidedAt: new Date(),
      })
      .where(inArray(graceApprovals.id, approvals.map((row) => row.id)));

    return NextResponse.json({
      results: execution.results,
      actionOutcomes: execution.actionOutcomes,
      failed: execution.results.filter((item) => !item.success),
      approvalsUpdated: approvals.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 }
    );
  }
}, OrganizationRole.enum.admin);
