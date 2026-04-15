import type { z } from "zod";
import type { AgencyTier, GraceChannel, GraceSessionContext, ToolResult } from "../types";

export type GraceTool = {
  name: string;
  description?: string;
  inputSchema?: z.ZodTypeAny;
  execute: (input: Record<string, unknown>, ctx: GraceSessionContext) => Promise<ToolResult>;
  requiresApproval?: boolean;
  allowedChannels: GraceChannel[];
  /**
   * Controls autonomous execution behavior:
   * - autonomous: Grace executes immediately (routine ops)
   * - suggest: Grace proposes action, staff confirms
   * - always_ask: Queued for explicit approval (high-impact)
   */
  agencyTier?: AgencyTier;
};
