"use server";

import { requireOrgMembership } from "./utils";
import { seedDemoDataForOrg } from "@/lib/seed/demo-data";
import * as z from "zod";

const organizationIdSchema = z.string().trim().min(1);

export async function seedDemoData(orgId: string) {
  const parsedOrgId = organizationIdSchema.parse(orgId);
  const seedEnabled =
    process.env.NODE_ENV !== "production" || process.env.ENABLE_SEED_TOOLS === "true";
  if (!seedEnabled) {
    throw new Error(
      "Demo seed is disabled in production. Set ENABLE_SEED_TOOLS=true to enable it intentionally."
    );
  }

  await requireOrgMembership(parsedOrgId, "admin");
  return seedDemoDataForOrg(parsedOrgId);
}
