import { db } from "@/db";
import { graceApprovals } from "@/db/schema/grace-approvals";
import type { ProposedAction } from "../types";

export async function queueApproval(params: {
  organizationId: string;
  sessionId: string;
  requestedByUserId?: string;
  action: ProposedAction;
}) {
  const [approval] = await db
    .insert(graceApprovals)
    .values({
      organizationId: params.organizationId,
      sessionId: params.sessionId,
      requestedByUserId: params.requestedByUserId ?? null,
      proposedAction: params.action as unknown as Record<string, unknown>,
      status: "pending",
    })
    .returning();
  return approval;
}
