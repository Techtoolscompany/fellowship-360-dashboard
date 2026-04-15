import { randomBytes, createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  smsDeviceEnrollmentTokens,
  smsDevices,
} from "@/db/schema/sms-gateway";
import { timingSafeEqualString } from "@/lib/security/compare";

const ENROLLMENT_TOKEN_PREFIX = "smsgw_enr";
const DEVICE_TOKEN_PREFIX = "smsgw_dev";
const DEFAULT_ENROLLMENT_TTL_MINUTES = 30;

export class SmsGatewayAuthError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "SmsGatewayAuthError";
    this.status = status;
  }
}

function hashGatewayToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function createGatewayToken(prefix: string) {
  const tokenId = randomBytes(8).toString("hex");
  const secret = randomBytes(24).toString("hex");
  const token = `${prefix}_${tokenId}.${secret}`;

  return {
    token,
    tokenId,
    tokenHash: hashGatewayToken(token),
  };
}

function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseGatewayToken(
  token: string | null | undefined,
  expectedPrefix: string
): { tokenId: string; normalizedToken: string } | null {
  const normalizedToken = normalizeText(token);
  if (!normalizedToken) return null;

  const prefix = `${expectedPrefix}_`;
  if (!normalizedToken.startsWith(prefix)) return null;

  const remainder = normalizedToken.slice(prefix.length);
  const separatorIndex = remainder.indexOf(".");
  if (separatorIndex <= 0 || separatorIndex === remainder.length - 1) {
    return null;
  }

  const tokenId = remainder.slice(0, separatorIndex);
  if (!tokenId) return null;

  return { tokenId, normalizedToken };
}

function readBearerToken(req: NextRequest): string | null {
  const authHeader = normalizeText(req.headers.get("authorization"));
  if (!authHeader) return null;

  const [scheme, value] = authHeader.split(/\s+/, 2);
  if (!scheme || scheme.toLowerCase() !== "bearer") return null;
  return normalizeText(value);
}

export async function issueSmsGatewayEnrollmentToken(params: {
  deviceId: string;
  organizationId?: string | null;
  expiresInMinutes?: number;
  metadataJson?: Record<string, unknown>;
}) {
  const expiresInMinutes = Math.max(
    1,
    params.expiresInMinutes ?? DEFAULT_ENROLLMENT_TTL_MINUTES
  );
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiresInMinutes * 60 * 1000);
  const enrollment = createGatewayToken(ENROLLMENT_TOKEN_PREFIX);

  await db
    .delete(smsDeviceEnrollmentTokens)
    .where(
      and(
        eq(smsDeviceEnrollmentTokens.deviceId, params.deviceId),
        isNull(smsDeviceEnrollmentTokens.consumedAt)
      )
    );

  await db.insert(smsDeviceEnrollmentTokens).values({
    deviceId: params.deviceId,
    organizationId: params.organizationId ?? null,
    tokenId: enrollment.tokenId,
    tokenHash: enrollment.tokenHash,
    expiresAt,
    metadataJson: params.metadataJson,
    createdAt: now,
  });

  return {
    token: enrollment.token,
    tokenId: enrollment.tokenId,
    expiresAt,
  };
}

export async function consumeSmsGatewayEnrollmentToken(params: {
  enrollmentToken: string;
  deviceName?: string | null;
  phoneNumber?: string | null;
  fcmToken?: string | null;
  statusJson?: Record<string, unknown> | null;
}) {
  const parsed = parseGatewayToken(params.enrollmentToken, ENROLLMENT_TOKEN_PREFIX);
  if (!parsed) {
    throw new SmsGatewayAuthError(401, "Invalid enrollment token");
  }

  const [enrollment] = await db
    .select()
    .from(smsDeviceEnrollmentTokens)
    .where(eq(smsDeviceEnrollmentTokens.tokenId, parsed.tokenId))
    .limit(1);

  if (!enrollment) {
    throw new SmsGatewayAuthError(401, "Enrollment token not found");
  }

  if (!timingSafeEqualString(enrollment.tokenHash, hashGatewayToken(parsed.normalizedToken))) {
    throw new SmsGatewayAuthError(401, "Invalid enrollment token");
  }

  if (enrollment.consumedAt) {
    throw new SmsGatewayAuthError(409, "Enrollment token has already been used");
  }

  const now = new Date();
  if (enrollment.expiresAt.getTime() <= now.getTime()) {
    throw new SmsGatewayAuthError(410, "Enrollment token has expired");
  }

  const [device] = await db
    .select()
    .from(smsDevices)
    .where(eq(smsDevices.id, enrollment.deviceId))
    .limit(1);

  if (!device) {
    throw new SmsGatewayAuthError(404, "Device not found for enrollment token");
  }

  const [claimedEnrollment] = await db
    .update(smsDeviceEnrollmentTokens)
    .set({ consumedAt: now })
    .where(
      and(
        eq(smsDeviceEnrollmentTokens.id, enrollment.id),
        isNull(smsDeviceEnrollmentTokens.consumedAt)
      )
    )
    .returning({ id: smsDeviceEnrollmentTokens.id });

  if (!claimedEnrollment) {
    throw new SmsGatewayAuthError(409, "Enrollment token has already been used");
  }

  const authToken = createGatewayToken(DEVICE_TOKEN_PREFIX);
  const nextDeviceName = normalizeText(params.deviceName) ?? device.deviceName;
  const phoneNumber = normalizeText(params.phoneNumber) ?? device.phoneNumber;
  const fcmToken = normalizeText(params.fcmToken) ?? device.fcmToken;

  const [updatedDevice] = await db
    .update(smsDevices)
    .set({
      deviceName: nextDeviceName,
      phoneNumber,
      fcmToken,
      authTokenId: authToken.tokenId,
      authTokenHash: authToken.tokenHash,
      authTokenIssuedAt: now,
      authTokenLastUsedAt: now,
      authTokenRevokedAt: null,
      enrolledAt: device.enrolledAt ?? now,
      statusJson: params.statusJson ?? device.statusJson,
      isActive: true,
      lastSeenAt: now,
      updatedAt: now,
    })
    .where(eq(smsDevices.id, device.id))
    .returning();

  if (!updatedDevice) {
    throw new SmsGatewayAuthError(404, "Device not found for enrollment token");
  }

  return {
    device: updatedDevice,
    authToken: authToken.token,
  };
}

export async function authenticateSmsGatewayDeviceToken(token: string) {
  const parsed = parseGatewayToken(token, DEVICE_TOKEN_PREFIX);
  if (!parsed) return null;

  const [device] = await db
    .select()
    .from(smsDevices)
    .where(eq(smsDevices.authTokenId, parsed.tokenId))
    .limit(1);

  if (!device?.authTokenHash || device.authTokenRevokedAt) {
    return null;
  }

  if (!timingSafeEqualString(device.authTokenHash, hashGatewayToken(parsed.normalizedToken))) {
    return null;
  }

  return device;
}

export async function resolveSmsGatewayDeviceRequestAuth(params: {
  req: NextRequest;
  deviceId?: string | null;
}) {
  const deviceToken =
    readBearerToken(params.req) ?? normalizeText(params.req.headers.get("x-device-token"));

  if (deviceToken) {
    const device = await authenticateSmsGatewayDeviceToken(deviceToken);
    if (!device) {
      throw new SmsGatewayAuthError(401, "Invalid device token");
    }

    if (params.deviceId && params.deviceId !== device.id) {
      throw new SmsGatewayAuthError(403, "Device token does not match deviceId");
    }

    return {
      device,
      authMethod: "device_token" as const,
    };
  }

  const apiKey = params.req.headers.get("x-api-key");
  if (!timingSafeEqualString(apiKey, process.env.SMS_GATEWAY_API_KEY)) {
    throw new SmsGatewayAuthError(401, "Unauthorized");
  }

  const deviceId = normalizeText(params.deviceId);
  if (!deviceId) {
    throw new SmsGatewayAuthError(400, "deviceId is required");
  }

  const [device] = await db
    .select()
    .from(smsDevices)
    .where(eq(smsDevices.id, deviceId))
    .limit(1);

  if (!device) {
    throw new SmsGatewayAuthError(404, "Device not found");
  }

  return {
    device,
    authMethod: "legacy_api_key" as const,
  };
}
