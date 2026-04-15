import { createAnthropic } from "@ai-sdk/anthropic";

export const DEFAULT_GRACE_CLAUDE_MODEL =
  process.env.GRACE_CLAUDE_MODEL?.trim() || "claude-sonnet-4-20250514";

export function createGraceAnthropicModel(apiKey: string) {
  const anthropic = createAnthropic({ apiKey });
  return anthropic(DEFAULT_GRACE_CLAUDE_MODEL);
}
