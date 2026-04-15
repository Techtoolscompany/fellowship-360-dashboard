const GEMINI_TTS_MODEL = "gemini-2.5-flash-preview-tts";
const GEMINI_TTS_SAMPLE_RATE = 24_000;
const GEMINI_TTS_CHANNELS = 1;
const GEMINI_TTS_BYTES_PER_SAMPLE = 2;
const DEFAULT_GEMINI_VOICE_NAME = "Kore";

type GeminiInlineAudioPart = {
  inlineData?: {
    data?: string;
    mimeType?: string;
  };
};

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: GeminiInlineAudioPart[];
    };
  }>;
  error?: {
    message?: string;
  };
};

function buildSpeechPrompt(text: string) {
  return [
    "Read the text between BEGIN_SPEECH and END_SPEECH exactly as written.",
    "Use a warm, calm, conversational tone suitable for a helpful church assistant.",
    "BEGIN_SPEECH",
    text,
    "END_SPEECH",
  ].join("\n");
}

function extractInlineAudio(
  response: GeminiGenerateContentResponse
): { data: string; mimeType: string | null } | null {
  for (const candidate of response.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      const data = part.inlineData?.data?.trim();
      if (data) {
        return {
          data,
          mimeType: part.inlineData?.mimeType?.trim() || null,
        };
      }
    }
  }

  return null;
}

export function pcmToWav(pcmData: Buffer) {
  const byteRate =
    GEMINI_TTS_SAMPLE_RATE * GEMINI_TTS_CHANNELS * GEMINI_TTS_BYTES_PER_SAMPLE;
  const blockAlign = GEMINI_TTS_CHANNELS * GEMINI_TTS_BYTES_PER_SAMPLE;
  const wavHeader = Buffer.alloc(44);

  wavHeader.write("RIFF", 0);
  wavHeader.writeUInt32LE(36 + pcmData.length, 4);
  wavHeader.write("WAVE", 8);
  wavHeader.write("fmt ", 12);
  wavHeader.writeUInt32LE(16, 16);
  wavHeader.writeUInt16LE(1, 20);
  wavHeader.writeUInt16LE(GEMINI_TTS_CHANNELS, 22);
  wavHeader.writeUInt32LE(GEMINI_TTS_SAMPLE_RATE, 24);
  wavHeader.writeUInt32LE(byteRate, 28);
  wavHeader.writeUInt16LE(blockAlign, 32);
  wavHeader.writeUInt16LE(GEMINI_TTS_BYTES_PER_SAMPLE * 8, 34);
  wavHeader.write("data", 36);
  wavHeader.writeUInt32LE(pcmData.length, 40);

  return Buffer.concat([wavHeader, pcmData]);
}

function getGeminiVoiceName() {
  const configured = process.env.GEMINI_TTS_VOICE_NAME?.trim();
  return configured || DEFAULT_GEMINI_VOICE_NAME;
}

export async function synthesizeSpeechWithGemini(params: {
  apiKey: string;
  text: string;
}) {
  const text = params.text.trim();
  if (!text) {
    throw new Error("Speech synthesis text cannot be empty.");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TTS_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": params.apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: buildSpeechPrompt(text),
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: getGeminiVoiceName(),
              },
            },
          },
        },
        model: GEMINI_TTS_MODEL,
      }),
    }
  );

  const payload = (await response.json()) as GeminiGenerateContentResponse;
  if (!response.ok) {
    throw new Error(payload.error?.message || `Gemini TTS returned ${response.status}`);
  }

  const inlineAudio = extractInlineAudio(payload);
  if (!inlineAudio) {
    throw new Error("Gemini TTS did not return audio data.");
  }

  if (inlineAudio.mimeType === "audio/wav") {
    return `data:audio/wav;base64,${inlineAudio.data}`;
  }

  const pcmData = Buffer.from(inlineAudio.data, "base64");
  const wavData = pcmToWav(pcmData);
  return `data:audio/wav;base64,${wavData.toString("base64")}`;
}
