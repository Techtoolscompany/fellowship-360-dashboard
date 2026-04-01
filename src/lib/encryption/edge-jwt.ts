import { SignJWT, jwtVerify } from "jose";
import { requireConfiguredSecret } from "@/lib/security/production-readiness";

export type TokenPurpose = "signup" | "reset-password" | "impersonation";

const TOKEN_ISSUER = "fellowship-360-auth";

interface EncryptJsonOptions {
  purpose: TokenPurpose;
  expiresIn?: string;
}

interface DecryptJsonOptions {
  purpose: TokenPurpose;
}

export class TokenValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TokenValidationError";
  }
}

/**
 * Encrypts data into a JWT token and URL encodes it for safe transport (Edge-compatible)
 * @param data The data to encrypt
 * @returns URL-encoded JWT token
 */
export const encryptJson = async <T>(
  data: T,
  options: EncryptJsonOptions
): Promise<string> => {
  const secret = new TextEncoder().encode(
    requireConfiguredSecret("AUTH_SECRET", process.env.AUTH_SECRET)
  );

  const payload =
    data && typeof data === "object"
      ? (data as Record<string, unknown>)
      : {};

  // Create JWT with jose library (Edge compatible)
  const token = await new SignJWT({
    ...payload,
    purpose: options.purpose,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(TOKEN_ISSUER)
    .setAudience(options.purpose)
    .setIssuedAt()
    .setExpirationTime(options.expiresIn ?? "30m")
    .sign(secret);

  // URL encode the token for safe transport in URLs
  return encodeURIComponent(token);
};

/**
 * Decrypts a JWT token and returns the original data (Edge-compatible)
 * @param token The URL-encoded JWT token to decrypt
 * @returns The original data
 */
export const decryptJson = async <T = Record<string, unknown>>(
  token: string,
  options: DecryptJsonOptions
): Promise<T> => {
  const authSecret = requireConfiguredSecret("AUTH_SECRET", process.env.AUTH_SECRET);

  try {
    // First URL decode the token
    const decodedToken = decodeURIComponent(token);

    const secret = new TextEncoder().encode(authSecret);

    // Verify and decode the JWT
    const { payload } = await jwtVerify(decodedToken, secret, {
      issuer: TOKEN_ISSUER,
      audience: options.purpose,
    });

    if (payload.purpose !== options.purpose) {
      throw new TokenValidationError("Token purpose mismatch");
    }

    return payload as unknown as T;
  } catch (error) {
    if (error instanceof TokenValidationError) {
      throw error;
    }

    throw new TokenValidationError("Failed to decrypt token");
  }
};
