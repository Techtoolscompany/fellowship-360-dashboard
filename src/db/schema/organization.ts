import {
  timestamp,
  pgTable,
  text,
  pgEnum,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";
import { plans } from "./plans";
import { z } from "zod";
import type { InferSelectModel } from "drizzle-orm";

export const roleEnum = pgEnum("role", ["admin", "owner", "user"]);

export const OrganizationRole = z.enum(roleEnum.enumValues);
export type OrganizationRole = z.infer<typeof OrganizationRole>;

export const onboardingDataSchema = z.object({
  orgName: z.string().default(""),
  orgWebsite: z.string().default(""),
  orgType: z.enum(["startup", "enterprise", "agency", "individual"]),
  teamSize: z.number().default(0),
  industry: z.string().default(""),
  howDidYouHearAboutUs: z.string().default(""),
});

export type OnboardingData = z.infer<typeof onboardingDataSchema>;

export const organizations = pgTable("organization", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  image: text("image"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow(),

  onboardingDone: boolean("onboardingDone").default(false),
  onboardingData: jsonb("onboardingData").$type<OnboardingData>(),
  // Billing fields moved from user to organization
  stripeCustomerId: text("stripeCustomerId"),
  stripeSubscriptionId: text("stripeSubscriptionId"),
  lemonSqueezyCustomerId: text("lemonSqueezyCustomerId"),
  lemonSqueezySubscriptionId: text("lemonSqueezySubscriptionId"),
  dodoCustomerId: text("dodoCustomerId"),
  dodoSubscriptionId: text("dodoSubscriptionId"),
  planId: text("planId").references(() => plans.id),
});

export type Organization = InferSelectModel<typeof organizations>;
