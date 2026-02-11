import type { GraceChannel } from "../types";

export const highRiskTools = new Set([
  "messages.sendSMS",
  "messages.sendEmail",
  "appointments.book",
  "contacts.upsert",
]);

export const allowedByChannel: Record<GraceChannel, Set<string>> = {
  voice: new Set([
    "churchInfo.search",
    "prayerRequests.create",
    "appointments.checkAvailability",
    "appointments.book",
    "handoff.transfer",
    "staff.alert",
    "contacts.upsert",
  ]),
  sms: new Set([
    "churchInfo.search",
    "prayerRequests.create",
    "appointments.checkAvailability",
    "appointments.book",
    "handoff.transfer",
    "contacts.upsert",
    "messages.sendSMS",
  ]),
  web: new Set([
    "churchInfo.search",
    "prayerRequests.create",
    "appointments.checkAvailability",
    "appointments.book",
    "handoff.transfer",
    "contacts.upsert",
  ]),
  in_app: new Set([
    "churchInfo.search",
    "prayerRequests.create",
    "appointments.checkAvailability",
    "appointments.book",
    "handoff.transfer",
    "contacts.upsert",
    "messages.sendSMS",
    "messages.sendEmail",
    "tasks.create",
    "staff.alert",
  ]),
};
