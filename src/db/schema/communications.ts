import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { organizations } from "./organization";
import { churchContacts } from "./church-contacts";
import { users } from "./user";

// ── Enums ──
export const channelEnum = pgEnum("comm_channel", [
  "phone",
  "sms",
  "email",
  "web",
  "in_person",
]);

export const conversationStatusEnum = pgEnum("conversation_status", [
  "open",
  "waiting",
  "resolved",
  "archived",
]);

export const messageDirectionEnum = pgEnum("message_direction", [
  "inbound",
  "outbound",
]);

export const messageSenderTypeEnum = pgEnum("message_sender_type", [
  "human",
  "ai",
  "system",
]);

export const broadcastStatusEnum = pgEnum("broadcast_status", [
  "draft",
  "scheduled",
  "sending",
  "sent",
  "failed",
]);

// ── Conversations ──
export const conversations = pgTable("conversation", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  contactId: text("contact_id").references(() => churchContacts.id, {
    onDelete: "set null",
  }),
  channel: channelEnum("channel").notNull(),
  status: conversationStatusEnum("status").default("open").notNull(),
  subject: text("subject"),
  assigneeId: text("assignee_id").references(() => users.id, {
    onDelete: "set null",
  }),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  lastMessageAt: timestamp("last_message_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ── Messages ──
export const messages = pgTable("message", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  direction: messageDirectionEnum("direction").notNull(),
  senderType: messageSenderTypeEnum("sender_type").default("human").notNull(),
  senderId: text("sender_id"),
  sentAt: timestamp("sent_at", { mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ── Broadcasts ──
export const broadcasts = pgTable("broadcast", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  content: text("content").notNull(),
  channel: channelEnum("channel").notNull(),
  status: broadcastStatusEnum("status").default("draft").notNull(),
  audienceFilter: jsonb("audience_filter"),
  scheduledAt: timestamp("scheduled_at", { mode: "date" }),
  sentAt: timestamp("sent_at", { mode: "date" }),
  totalRecipients: integer("total_recipients").default(0),
  totalDelivered: integer("total_delivered").default(0),
  totalOpened: integer("total_opened").default(0),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ── Templates ──
export const messageTemplates = pgTable("message_template", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  content: text("content").notNull(),
  category: text("category"),
  channel: channelEnum("channel"),
  variables: jsonb("variables").$type<string[]>(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});
