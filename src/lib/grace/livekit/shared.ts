import { z } from "zod";

export const GRACE_LIVEKIT_AGENT_NAME = "grace_gemini_live";

const graceLivekitParticipantContextSchema = z.object({
  organizationId: z.string().min(1),
  userId: z.string().min(1),
  userName: z.string().nullable().optional(),
  graceThreadId: z.string().min(1).nullable().optional(),
  originSurface: z.literal("grace_command_center").default("grace_command_center"),
});

export type GraceLivekitParticipantContext = z.infer<
  typeof graceLivekitParticipantContextSchema
>;

export function buildGraceLivekitParticipantMetadata(
  context: GraceLivekitParticipantContext
) {
  return JSON.stringify(graceLivekitParticipantContextSchema.parse(context));
}

export function parseGraceLivekitParticipantMetadata(
  value: string | null | undefined
) {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as unknown;
    const result = graceLivekitParticipantContextSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function getGraceLivekitParticipantContext(params: {
  metadata?: string | null;
  attributes?: Record<string, string> | null;
}) {
  const fromMetadata = parseGraceLivekitParticipantMetadata(params.metadata);
  if (fromMetadata) {
    return fromMetadata;
  }

  const fallback = graceLivekitParticipantContextSchema.safeParse({
    organizationId: params.attributes?.organizationId,
    userId: params.attributes?.userId,
    userName: params.attributes?.userName ?? null,
    graceThreadId:
      params.attributes?.graceThreadId ??
      params.attributes?.["grace.thread_id"] ??
      null,
    originSurface: params.attributes?.originSurface ?? "grace_command_center",
  });

  return fallback.success ? fallback.data : null;
}
