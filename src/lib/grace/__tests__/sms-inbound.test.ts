import { describe, expect, it } from "vitest";
import { selectReusableSmsGraceSessionId } from "../channels/sms/threading";

describe("selectReusableSmsGraceSessionId", () => {
  it("reuses the newest open session for the same sender phone", () => {
    const sessionId = selectReusableSmsGraceSessionId({
      fromNumber: "+1 (555) 111-2222",
      recentMessages: [
        {
          sessionId: "session-newest",
          metadataJson: {
            fromNumber: "+1 (555) 111-2222",
          },
        },
        {
          sessionId: "session-older",
          metadataJson: {
            fromPhone: "5551112222",
          },
        },
      ],
      sessions: [
        { id: "session-newest", status: "open" },
        { id: "session-older", status: "open" },
      ],
    });

    expect(sessionId).toBe("session-newest");
  });

  it("skips a closed matching session and falls back to the next open match", () => {
    const sessionId = selectReusableSmsGraceSessionId({
      fromNumber: "555-111-2222",
      recentMessages: [
        {
          sessionId: "session-closed",
          metadataJson: {
            normalizedFromNumber: "5551112222",
          },
        },
        {
          sessionId: "session-open",
          metadataJson: {
            fromNumber: "+1 555 111 2222",
          },
        },
      ],
      sessions: [
        { id: "session-closed", status: "closed" },
        { id: "session-open", status: "open" },
      ],
    });

    expect(sessionId).toBe("session-open");
  });

  it("returns null when no recent message metadata matches the sender phone", () => {
    const sessionId = selectReusableSmsGraceSessionId({
      fromNumber: "555-111-2222",
      recentMessages: [
        {
          sessionId: "session-other",
          metadataJson: {
            fromNumber: "+1 555 999 8888",
          },
        },
      ],
      sessions: [{ id: "session-other", status: "open" }],
    });

    expect(sessionId).toBeNull();
  });
});
