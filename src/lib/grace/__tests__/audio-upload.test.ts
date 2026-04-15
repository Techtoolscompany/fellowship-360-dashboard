import { describe, expect, it } from "vitest";
import {
  canonicalizeGraceAudioMimeType,
  extractGraceAudioUpload,
  pickGraceLiveRecorderMimeType,
  pickGraceRecorderMimeType,
  resolveGraceRecordedAudioMimeType,
} from "../audio-upload";

describe("grace audio upload helpers", () => {
  it("prefers the first recorder mime type the browser supports", () => {
    const mimeType = pickGraceRecorderMimeType((candidate) =>
      candidate === "audio/mp4" || candidate === "audio/ogg"
    );

    expect(mimeType).toBe("audio/mp4");
  });

  it("prefers a live-safe recorder mime type before webm", () => {
    const mimeType = pickGraceLiveRecorderMimeType((candidate) =>
      candidate === "audio/webm" || candidate === "audio/ogg"
    );

    expect(mimeType).toBe("audio/ogg");
  });

  it("canonicalizes audio mime types before upload", () => {
    expect(canonicalizeGraceAudioMimeType(" audio/webm;codecs=opus ")).toBe("audio/webm");
    expect(canonicalizeGraceAudioMimeType("video/mp4")).toBeNull();
  });

  it("resolves the recorded upload mime type from the recorder first", () => {
    const mimeType = resolveGraceRecordedAudioMimeType({
      recorderMimeType: "audio/mp4;codecs=mp4a.40.2",
      chunkMimeType: "audio/webm",
      fallbackMimeType: "audio/ogg",
    });

    expect(mimeType).toBe("audio/mp4");
  });

  it("extracts mime type and payload from audio data urls", () => {
    const result = extractGraceAudioUpload({
      audioData: "data:audio/webm;codecs=opus;base64,Zm9v",
    });

    expect(result).toEqual({
      base64Data: "Zm9v",
      mimeType: "audio/webm",
    });
  });

  it("uses the declared mime type when the payload is raw base64", () => {
    const result = extractGraceAudioUpload({
      audioData: "YmFy",
      declaredMimeType: "audio/mp4;codecs=mp4a.40.2",
    });

    expect(result).toEqual({
      base64Data: "YmFy",
      mimeType: "audio/mp4",
    });
  });
});
