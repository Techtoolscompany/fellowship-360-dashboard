import { describe, expect, it } from "vitest";
import { pcmToWav } from "../gemini-tts";

describe("pcmToWav", () => {
  it("wraps raw Gemini PCM output in a playable wav container", () => {
    const pcm = Buffer.from([0x00, 0x00, 0xff, 0x7f]);
    const wav = pcmToWav(pcm);

    expect(wav.toString("ascii", 0, 4)).toBe("RIFF");
    expect(wav.toString("ascii", 8, 12)).toBe("WAVE");
    expect(wav.toString("ascii", 12, 16)).toBe("fmt ");
    expect(wav.toString("ascii", 36, 40)).toBe("data");
    expect(wav.readUInt16LE(22)).toBe(1);
    expect(wav.readUInt32LE(24)).toBe(24_000);
    expect(wav.readUInt16LE(34)).toBe(16);
    expect(wav.readUInt32LE(40)).toBe(pcm.length);
    expect(wav.subarray(44)).toEqual(pcm);
  });
});
