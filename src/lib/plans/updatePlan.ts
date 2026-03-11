import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { organizations } from "@/db/schema/organization";
import APIError from "../api/errors";
import { plans } from "@/db/schema/plans";
import { organizationMemberships } from "@/db/schema/organization-membership";
import { users } from "@/db/schema/user";
import sendMail from "@/lib/email/sendMail";

const updatePlan = async ({
  organizationId,
  newPlanId,
  sendEmail = true,
}: {
  organizationId: string;
  newPlanId: string;
  sendEmail?: boolean;
}) => {
  // Update the organization's plan
  await db
    .update(organizations)
    .set({ planId: newPlanId })
    .where(eq(organizations.id, organizationId));

  if (sendEmail) {
    const plan = await db
      .select({ name: plans.name })
      .from(plans)
      .where(eq(plans.id, newPlanId))
      .limit(1)
      .then((res) => res[0]);

    if (!plan) {
      throw new APIError("Plan not found");
    }

    const organization = await db
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1)
      .then((res) => res[0]);

    if (!organization) {
      throw new APIError("Organization not found");
    }

    const recipients = await db
      .select({
        email: users.email,
      })
      .from(organizationMemberships)
      .innerJoin(users, eq(organizationMemberships.userId, users.id))
      .where(
        and(
          eq(organizationMemberships.organizationId, organizationId),
          inArray(organizationMemberships.role, ["owner", "admin"])
        )
      );

    const recipientEmails = Array.from(
      new Set(
        recipients
          .map((row) => row.email?.trim())
          .filter((email): email is string => Boolean(email))
      )
    );

    if (recipientEmails.length === 0) {
      return;
    }

    const subject = `Plan updated: ${plan.name}`;
    const html = `
      <p>Hello,</p>
      <p><strong>${organization.name}</strong> has been moved to the <strong>${plan.name}</strong> plan.</p>
      <p>If this was unexpected, please contact support.</p>
    `;

    const results = await Promise.allSettled(
      recipientEmails.map((email) => sendMail(email, subject, html))
    );
    const failedCount = results.filter((result) => result.status === "rejected").length;
    if (failedCount > 0) {
      console.error(
        `Plan update email failed for ${failedCount}/${recipientEmails.length} recipient(s)`,
        { organizationId, newPlanId }
      );
    }
  }
};

export default updatePlan;
