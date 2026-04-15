export const GRACE_PREFERRED_AUDIO_RECORDER_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/ogg",
] as const;

export const GRACE_PREFERRED_LIVE_AUDIO_RECORDER_MIME_TYPES = [
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/ogg",
  "audio/webm;codecs=opus",
  "audio/webm",
] as const;

export const DEFAULT_GRACE_AUDIO_MIME_TYPE = "audio/webm";

export function canonicalizeGraceAudioMimeType(mimeType?: string | null) {
  if (typeof mimeType !== "string") return null;

  const trimmed = mimeType.trim().toLowerCase();
  if (!trimmed.startsWith("audio/")) {
    return null;
  }

  return trimmed.split(";", 1)[0] ?? null;
}

export function pickGraceRecorderMimeType(
  isTypeSupported?: ((mimeType: string) => boolean) | null
) {
  if (!isTypeSupported) {
    return null;
  }

  for (const mimeType of GRACE_PREFERRED_AUDIO_RECORDER_MIME_TYPES) {
    if (isTypeSupported(mimeType)) {
      return mimeType;
    }
  }

  return null;
}

export function pickGraceLiveRecorderMimeType(
  isTypeSupported?: ((mimeType: string) => boolean) | null
) {
  if (!isTypeSupported) {
    return null;
  }

  for (const mimeType of GRACE_PREFERRED_LIVE_AUDIO_RECORDER_MIME_TYPES) {
    if (isTypeSupported(mimeType)) {
      return mimeType;
    }
  }

  return null;
}

export function resolveGraceRecordedAudioMimeType(params: {
  recorderMimeType?: string | null;
  chunkMimeType?: string | null;
  fallbackMimeType?: string | null;
}) {
  return (
    canonicalizeGraceAudioMimeType(params.recorderMimeType) ??
    canonicalizeGraceAudioMimeType(params.chunkMimeType) ??
    canonicalizeGraceAudioMimeType(params.fallbackMimeType) ??
    DEFAULT_GRACE_AUDIO_MIME_TYPE
  );
}

export function extractGraceAudioUpload(params: {
  audioData: string;
  declaredMimeType?: string | null;
}) {
  const trimmedAudioData = params.audioData.trim();
  const dataUrlMatch = /^data:([^,]+),(.*)$/.exec(trimmedAudioData);

  if (!dataUrlMatch) {
    return {
      base64Data: trimmedAudioData,
      mimeType:
        canonicalizeGraceAudioMimeType(params.declaredMimeType) ??
        DEFAULT_GRACE_AUDIO_MIME_TYPE,
    };
  }

  const [, metadata, payload] = dataUrlMatch;
  const normalizedMetadata = metadata.replace(/;base64$/i, "");

  return {
    base64Data: payload,
    mimeType:
      canonicalizeGraceAudioMimeType(params.declaredMimeType) ??
      canonicalizeGraceAudioMimeType(normalizedMetadata) ??
      DEFAULT_GRACE_AUDIO_MIME_TYPE,
  };
}
