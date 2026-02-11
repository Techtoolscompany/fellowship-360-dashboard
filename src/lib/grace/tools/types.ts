import type { GraceChannel, GraceSessionContext, ToolResult } from "../types";

export type GraceTool = {
  name: string;
  execute: (input: Record<string, unknown>, ctx: GraceSessionContext) => Promise<ToolResult>;
  requiresApproval?: boolean;
  allowedChannels: GraceChannel[];
};
