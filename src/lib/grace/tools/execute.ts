import type { GraceSessionContext, ToolResult } from "../types";
import { findGraceTool } from "./registry";

export async function executeGraceToolByName(params: {
  name: string;
  input: Record<string, unknown>;
  context: GraceSessionContext;
}): Promise<ToolResult> {
  const tool = findGraceTool(params.name);
  if (!tool) {
    return { success: false, error: `Unknown tool: ${params.name}` };
  }

  if (!tool.allowedChannels.includes(params.context.channel)) {
    return {
      success: false,
      error: `Tool ${params.name} is not allowed on channel ${params.context.channel}`,
    };
  }

  return tool.execute(params.input, params.context);
}
