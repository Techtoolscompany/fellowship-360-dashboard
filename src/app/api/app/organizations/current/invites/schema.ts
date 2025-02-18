import { z } from "zod";
import { invitations, OrganizationRole } from "@/db/schema";
import { InferSelectModel } from "drizzle-orm";

export const createInviteSchema = z.object({
  email: z.string().email(),
  role: z.enum([OrganizationRole.enum.user, OrganizationRole.enum.admin]),
});

export const revokeInviteSchema = z.object({
  inviteId: z.string(),
});

export const updateInviteRoleSchema = z.object({
  inviteId: z.string(),
  role: z.enum([OrganizationRole.enum.user, OrganizationRole.enum.admin]),
});

export type CreateInviteSchema = z.infer<typeof createInviteSchema>;
export type RevokeInviteSchema = z.infer<typeof revokeInviteSchema>;
export type UpdateInviteRoleSchema = z.infer<typeof updateInviteRoleSchema>;

export type Invitation = InferSelectModel<typeof invitations>;
