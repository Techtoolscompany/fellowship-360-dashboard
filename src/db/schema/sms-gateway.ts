import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  boolean,
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
export const smsDevices = pgTable("sms_devices", {
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
  isActive: boolean("is_active").notNull().default(true),
  lastSeenAt: timestamp("last_seen_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
});

/**
 * Full SMS message log per organization.
 * Tracks both inbound and outbound messages through the gateway.
 */
export const smsMessages = pgTable("sms_messages", {
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
  sentAt: timestamp("sent_at", { mode: "date" }),
  deliveredAt: timestamp("delivered_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});
