import { describe, it, expect, beforeAll } from "vitest";
import { encryptValue, decryptValue, isEncryptedValue, normalizeAndEncryptProviderConfig } from "../providers/security";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-key-for-unit-tests-only";
});

// ── Encrypt / Decrypt round-trip ────────────────────────────────────────────

describe("encryptValue / decryptValue", () => {
  it("produces an enc:v1 prefixed string", () => {
    const encrypted = encryptValue("my-api-key");
    expect(encrypted).toMatch(/^enc:v1:/);
  });

  it("round-trips correctly", () => {
    const plain = "super-secret-textbee-key";
    expect(decryptValue(encryptValue(plain))).toBe(plain);
  });

  it("each encryption produces a unique ciphertext (random IV)", () => {
    const a = encryptValue("same-value");
    const b = encryptValue("same-value");
    expect(a).not.toBe(b);
    // But both decrypt to the same plaintext
    expect(decryptValue(a)).toBe(decryptValue(b));
  });

  it("throws on tampered ciphertext", () => {
    const encrypted = encryptValue("sensitive");
    const tampered = encrypted.slice(0, -3) + "xxx";
    expect(() => decryptValue(tampered)).toThrow();
  });

  it("throws on malformed input", () => {
    expect(() => decryptValue("not-an-encrypted-value")).toThrow("Invalid encrypted value format");
  });
});

// ── isEncryptedValue ────────────────────────────────────────────────────────

describe("isEncryptedValue", () => {
  it("returns true for encrypted strings", () => {
    expect(isEncryptedValue(encryptValue("hello"))).toBe(true);
  });

  it("returns false for plain strings", () => {
    expect(isEncryptedValue("plain-text")).toBe(false);
  });

  it("returns false for non-string values", () => {
    expect(isEncryptedValue(null)).toBe(false);
    expect(isEncryptedValue(42)).toBe(false);
    expect(isEncryptedValue(undefined)).toBe(false);
  });
});

// ── normalizeAndEncryptProviderConfig ───────────────────────────────────────

describe("normalizeAndEncryptProviderConfig", () => {
  it("encrypts secret fields when stored provider credentials are supplied", () => {
    const { configJson, validation } = normalizeAndEncryptProviderConfig({
      channel: "sms",
      provider: "textbee",
      mode: "byo",
      incoming: { apiKey: "raw-key", baseUrl: "https://api.textbee.dev" },
    });

    expect(isEncryptedValue(configJson.apiKey)).toBe(true);
    expect(configJson.baseUrl).toBe("https://api.textbee.dev");
    expect(validation.isValid).toBe(true);
  });

  it("reports missing required fields", () => {
    const { validation } = normalizeAndEncryptProviderConfig({
      channel: "sms",
      provider: "textbee",
      mode: "byo",
      incoming: { baseUrl: "https://api.textbee.dev" }, // missing apiKey
    });

    expect(validation.isValid).toBe(false);
    expect(validation.missing).toContain("apiKey");
  });

  it("preserves already-encrypted values unchanged", () => {
    const preEncrypted = encryptValue("existing-key");
    const { configJson } = normalizeAndEncryptProviderConfig({
      channel: "sms",
      provider: "textbee",
      mode: "byo",
      existing: { apiKey: preEncrypted, baseUrl: "https://api.textbee.dev" },
      incoming: {},
    });

    expect(configJson.apiKey).toBe(preEncrypted);
  });
});
