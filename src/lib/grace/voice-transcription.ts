import type { ModelMessage } from "ai";

export function buildGraceVoiceTranscriptionMessages(params: {
  base64Audio: string;
  audioMediaType: string;
}): ModelMessage[] {
  return [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "Transcribe this church staff voice note.",
        },
        {
          type: "file",
          data: params.base64Audio,
          mediaType: params.audioMediaType,
        },
      ],
    },
  ];
}
