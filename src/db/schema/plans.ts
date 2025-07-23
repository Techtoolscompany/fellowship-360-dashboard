import {
  boolean,
  timestamp,
  pgTable,
  text,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";
import { z } from "zod";

export const quotaSchema = z.object({
  canUseApp: z.boolean().default(true),
  numberOfThings: z.number(),
  somethingElse: z.string(),
  teamMembers: z.number().default(1),
});

export type Quotas = z.infer<typeof quotaSchema>;

export const defaultQuotas: Quotas = {
  canUseApp: false,
  numberOfThings: 10,
  somethingElse: "string quota",
  teamMembers: 1,
};

export const plans = pgTable("plans", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  codename: text("codename").unique(),
  default: boolean("default").default(false),

  // Number of coupons required to activate this plan
  requiredCouponCount: integer("requiredCouponCount"),

  hasOnetimePricing: boolean("hasOnetimePricing").default(false),
  hasMonthlyPricing: boolean("hasMonthlyPricing").default(false),
  hasYearlyPricing: boolean("hasYearlyPricing").default(false),

  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow(),

  monthlyPrice: integer("monthlyPrice"),
  monthlyPriceAnchor: integer("monthlyPriceAnchor"),
  monthlyStripePriceId: text("monthlyStripePriceId"),
  monthlyLemonSqueezyVariantId: text("monthlyLemonSqueezyVariantId"),
  monthlyDodoProductId: text("monthlyDodoProductId"),
  monthlyPaypalPlanId: text("monthlyPaypalPlanId"),

  yearlyPrice: integer("yearlyPrice"),
  yearlyPriceAnchor: integer("yearlyPriceAnchor"),
  yearlyStripePriceId: text("yearlyStripePriceId"),
  yearlyLemonSqueezyVariantId: text("yearlyLemonSqueezyVariantId"),
  yearlyDodoProductId: text("yearlyDodoProductId"),
  yearlyPaypalPlanId: text("yearlyPaypalPlanId"),

  onetimePrice: integer("onetimePrice"),
  onetimePriceAnchor: integer("onetimePriceAnchor"),
  onetimeStripePriceId: text("onetimeStripePriceId"),
  onetimeLemonSqueezyVariantId: text("onetimeLemonSqueezyVariantId"),
  onetimeDodoProductId: text("onetimeDodoProductId"),
  onetimePaypalPlanId: text("onetimePaypalPlanId"),
  
  quotas: jsonb("quotas").$type<Quotas>(),
});
