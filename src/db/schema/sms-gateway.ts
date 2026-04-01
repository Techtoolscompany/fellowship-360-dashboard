import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  boolean,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organizations } from "./organization";

export const smsDirectionEnum = pgEnum("sms_direction", [
  "inbound",
  "outbound",
]);

export const smsStatusEnum = pgEnum("sms_status", [
  "queued",
  "sent",
  "delivered",
  "failed",
]);

/**
 * Android gateway devices managed by the agency.
 * Each device has a SIM card = unique phone number.
 * Devices are assigned to organizations by super admin.
 */
export const smsDevices = pgTable(
  "sms_devices",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id").references(
      () => organizations.id,
      { onDelete: "set null" }
    ),
    deviceName: text("device_name").notNull(),
    phoneNumber: text("phone_number"),
    fcmToken: text("fcm_token"),
    authTokenId: text("auth_token_id"),
    authTokenHash: text("auth_token_hash"),
    authTokenIssuedAt: timestamp("auth_token_issued_at", { mode: "date" }),
    authTokenLastUsedAt: timestamp("auth_token_last_used_at", { mode: "date" }),
    authTokenRevokedAt: timestamp("auth_token_revoked_at", { mode: "date" }),
    enrolledAt: timestamp("enrolled_at", { mode: "date" }),
    statusJson: jsonb("status_json").$type<Record<string, unknown>>(),
    isActive: boolean("is_active").notNull().default(true),
    lastSeenAt: timestamp("last_seen_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
  },
  (table) => ({
    authTokenIdUidx: uniqueIndex("sms_devices_auth_token_id_uidx").on(
      table.authTokenId
    ),
  })
);

export const smsDeviceEnrollmentTokens = pgTable(
  "sms_device_enrollment_tokens",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    deviceId: text("device_id")
      .notNull()
      .references(() => smsDevices.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    tokenId: text("token_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    consumedAt: timestamp("consumed_at", { mode: "date" }),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    tokenIdUidx: uniqueIndex("sms_device_enrollment_tokens_token_id_uidx").on(
      table.tokenId
    ),
  })
);

/**
 * Full SMS message log per organization.
 * Tracks both inbound and outbound messages through the gateway.
 */
export const smsMessages = pgTable(
  "sms_messages",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    deviceId: text("device_id").references(() => smsDevices.id, {
      onDelete: "set null",
    }),
    direction: smsDirectionEnum("direction").notNull(),
    fromNumber: text("from_number"),
    toNumber: text("to_number"),
    body: text("body").notNull(),
    status: smsStatusEnum("status").notNull().default("queued"),
    idempotencyKey: text("idempotency_key"),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>(),
    sentAt: timestamp("sent_at", { mode: "date" }),
    deliveredAt: timestamp("delivered_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    outboundIdempotencyRecipientUidx: uniqueIndex(
      "sms_messages_outbound_idempotency_recipient_uidx"
    ).on(table.organizationId, table.direction, table.idempotencyKey, table.toNumber),
  })
);
