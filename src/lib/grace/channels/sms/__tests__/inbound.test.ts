import { describe, expect, it } from "vitest";
import { selectReusableSmsGraceSessionId } from "../threading";

describe("selectReusableSmsGraceSessionId", () => {
  it("reuses the latest open session for the same sender phone", () => {
    const sessionId = selectReusableSmsGraceSessionId({
      fromNumber: "+1 (555) 123-4567",
      recentMessages: [
        {
          sessionId: "sess_closed",
          metadataJson: { fromPhone: "(555) 123-4567" },
        },
        {
          sessionId: "sess_open",
          metadataJson: { normalizedFromNumber: "5551234567" },
        },
      ],
      sessions: [
        { id: "sess_closed", status: "closed" },
        { id: "sess_open", status: "open" },
      ],
    });

    expect(sessionId).toBe("sess_open");
  });

  it("returns null when the sender phone does not match an open session", () => {
    const sessionId = selectReusableSmsGraceSessionId({
      fromNumber: "5559990000",
      recentMessages: [
        {
          sessionId: "sess_open",
          metadataJson: { fromPhone: "5551234567" },
        },
      ],
      sessions: [{ id: "sess_open", status: "open" }],
    });

    expect(sessionId).toBeNull();
  });
});
