import { describe, expect, it } from "vitest";
import { modelMessageSchema } from "ai";
import { buildGraceVoiceTranscriptionMessages } from "../voice-transcription";

describe("buildGraceVoiceTranscriptionMessages", () => {
  it("builds a valid AI SDK model message payload for audio transcription", () => {
    const messages = buildGraceVoiceTranscriptionMessages({
      base64Audio: "Zm9v",
      audioMediaType: "audio/webm",
    });

    expect(() => modelMessageSchema.parse(messages[0])).not.toThrow();
    expect(messages[0]).toEqual({
      role: "user",
      content: [
        {
          type: "text",
          text: "Transcribe this church staff voice note.",
        },
        {
          type: "file",
          data: "Zm9v",
          mediaType: "audio/webm",
        },
      ],
    });
  });
});
