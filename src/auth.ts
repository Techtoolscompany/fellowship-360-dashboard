import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { type EmailConfig } from "next-auth/providers/email";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "./db";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import {
  accounts,
  sessions,
  users,
  verificationTokens,
} from "./db/schema/user";
import onUserCreate from "./lib/users/onUserCreate";
import { render } from "@react-email/components";
import MagicLinkEmail from "./emails/MagicLinkEmail";
import sendMail from "./lib/email/sendMail";
import { appConfig } from "./lib/config";
import { decryptJson } from "./lib/encryption/edge-jwt";
import { eq, sql } from "drizzle-orm";
import {
  logSuperAdminAudit,
  resolveSuperAdminAccess,
  superAdminHasPermission,
} from "./lib/super-admin/auth";
import type {
  SuperAdminMembershipStatus,
  SuperAdminPermission,
  SuperAdminRole,
} from "./lib/super-admin/permissions";
import { assertStrongSecretInProduction } from "./lib/security/production-readiness";

assertStrongSecretInProduction(
  "AUTH_SECRET",
  process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
);

// Overrides default session type
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      impersonatedBy?: string;
      superAdmin?: {
        membershipId: string;
        role: SuperAdminRole;
        status: SuperAdminMembershipStatus;
        permissions: SuperAdminPermission[];
      };
    };
    expires: string;
  }
}

interface ImpersonateToken {
  impersonateIntoId: string;
  impersonateIntoEmail: string;
  impersonator: string;
}

const emailProvider: EmailConfig = {
  id: "email",
  type: "email",
  name: "Email",
  async sendVerificationRequest(params) {
    if (process.env.NODE_ENV === "development") {
      console.log(
        `Magic link for ${params.identifier}: ${params.url} expires at ${params.expires}`
      );
    }
    const html = await render(
      MagicLinkEmail({ url: params.url, expiresAt: params.expires })
    );

    await sendMail(
      params.identifier,
      `Sign in to ${appConfig.projectName}`,
      html
    );
  },
};

const adapter = DrizzleAdapter(db, {
  usersTable: users,
  accountsTable: accounts,
  sessionsTable: sessions,
  verificationTokensTable: verificationTokens,
});

function isLocalHostUrl(value: string | undefined) {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return (
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "::1"
    );
  } catch {
    return false;
  }
}

const authBaseUrl =
  process.env.AUTH_URL ||
  process.env.NEXTAUTH_URL ||
  process.env.NEXT_PUBLIC_APP_URL;
const shouldTrustHost =
  process.env.AUTH_TRUST_HOST === "true" ||
  process.env.NODE_ENV !== "production" ||
  isLocalHostUrl(authBaseUrl);

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: shouldTrustHost,
  pages: {
    signIn: "/sign-in",
    signOut: "/sign-out",
  },
  session: {
    strategy: "jwt",
  },
  adapter: {
    ...adapter,
    createUser: async (user) => {
      if (!adapter.createUser) {
        throw new Error("Adapter is not initialized");
      }
      const newUser = await adapter.createUser(user);
      // Update the user with the default plan
      await onUserCreate(newUser);

      return newUser;
    },
  },
  callbacks: {
    async signIn() {
      return process.env.NEXT_PUBLIC_SIGNIN_ENABLED === "true";
    },
    async session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      if (token.email) {
        session.user.email = token.email;
      }
      if (token.impersonatedBy) {
        session.user.impersonatedBy = token.impersonatedBy as string;
      }
      if (
        token.isSuperAdmin &&
        token.superAdminMembershipId &&
        token.superAdminRole &&
        token.superAdminStatus
      ) {
        session.user.superAdmin = {
          membershipId: token.superAdminMembershipId as string,
          role: token.superAdminRole as SuperAdminRole,
          status: token.superAdminStatus as SuperAdminMembershipStatus,
          permissions: (token.superAdminPermissions as SuperAdminPermission[]) ?? [],
        };
      }
      return session;
    },
    async jwt({ token, user }) {
      // If user object is available (after sign in), check if impersonation is happening
      if (user && "impersonatedBy" in user) {
        token.impersonatedBy = user.impersonatedBy;
      }

      // NOTE: Do not add anything else to the token, except for the sub
      // This avoids stale data problems, while increasing db roundtrips
      // which is acceptable while starting small.
      const nextToken = {
        sub: token.sub,
        email: (user?.email ?? token.email) || undefined,
        impersonatedBy: token.impersonatedBy,
        iat: token.iat,
        exp: token.exp,
        jti: token.jti,
      };

      const access = await resolveSuperAdminAccess({
        userId: user?.id ?? token.sub,
        email: user?.email ?? token.email,
      });

      if (!access) {
        return {
          ...nextToken,
          isSuperAdmin: false,
        };
      }

      return {
        ...nextToken,
        isSuperAdmin: access.isActive,
        superAdminMembershipId: access.membershipId,
        superAdminRole: access.role,
        superAdminStatus: access.status,
        superAdminPermissions: access.permissions,
      };
    },
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // NOTE: allowDangerousEmailAccountLinking removed for security.
      // Users must use the same provider they originally signed up with.
    }),
    emailProvider,
    // Password-based authentication
    ...(appConfig.auth?.enablePasswordAuth
      ? [
          CredentialsProvider({
            id: "credentials",
            name: "Credentials",
            credentials: {
              email: {
                label: "Email",
                type: "email",
                placeholder: "name@example.com",
              },
              password: {
                label: "Password",
                type: "password",
              },
            },
            async authorize(credentials) {
              if (!credentials?.email || !credentials?.password) {
                return null;
              }

              try {
                const normalizedEmail = String(credentials.email)
                  .trim()
                  .toLowerCase();

                // Find user by email
                const user = await db
                  .select({
                    id: users.id,
                    email: users.email,
                    name: users.name,
                    password: users.password,
                  })
                  .from(users)
                  .where(sql`lower(${users.email}) = ${normalizedEmail}`)
                  .limit(1)
                  .then((users) => users[0]);

                if (!user || !user.password) {
                  return null;
                }

                const { verifyPassword } = await import("./lib/auth/password");
                // Verify password
                const passwordCorrect = await verifyPassword(
                  credentials.password as string,
                  user.password
                );

                if (!passwordCorrect) {
                  return null;
                }

                return {
                  id: user.id,
                  email: user.email,
                  name: user.name,
                };
              } catch (error) {
                console.error("Error during password authentication:", error);
                return null;
              }
            },
          }),
        ]
      : []),
    // Impersonation provider (super admin only)
    CredentialsProvider({
      id: "impersonation",
      name: "Impersonation",
      credentials: {
        signedToken: {
          label: "Signed Token",
          type: "text",
          placeholder: "Signed Token",
          required: true,
        },
      },
      async authorize(credentials) {
        if (!credentials?.signedToken) {
          return null;
        }

        try {
          // The token is already URL encoded, decryptJson handles the decoding
          const impersonationToken = await decryptJson<ImpersonateToken>(
            credentials.signedToken as string,
            { purpose: "impersonation" }
          );

          const [targetUser, impersonatorUser] = await Promise.all([
            db
              .select({
                id: users.id,
                email: users.email,
              })
              .from(users)
              .where(eq(users.id, impersonationToken.impersonateIntoId))
              .limit(1)
              .then((rows) => rows[0]),
            db
              .select({
                id: users.id,
                email: users.email,
              })
              .from(users)
              .where(eq(users.id, impersonationToken.impersonator))
              .limit(1)
              .then((rows) => rows[0]),
          ]);

          if (!targetUser || !impersonatorUser) {
            return null;
          }

          if (
            targetUser.email.toLowerCase() !==
            impersonationToken.impersonateIntoEmail.toLowerCase()
          ) {
            return null;
          }

          const impersonatorAccess = await resolveSuperAdminAccess({
            userId: impersonatorUser.id,
            email: impersonatorUser.email,
          });

          if (
            !impersonatorAccess?.isActive ||
            !superAdminHasPermission(impersonatorAccess, "impersonate_users")
          ) {
            return null;
          }

          if (targetUser.id === impersonatorUser.id) {
            return null;
          }

          await logSuperAdminAudit({
            actorUserId: impersonatorUser.id,
            actionType: "impersonation_started",
            entityName: "app_user",
            entityId: targetUser.id,
            details: {
              targetUserId: targetUser.id,
              targetUserEmail: targetUser.email,
            },
          });

          return {
            id: targetUser.id,
            email: targetUser.email,
            impersonatedBy: impersonatorUser.id,
          };
        } catch (error) {
          console.error("Error during impersonation:", error);
          return null;
        }
      },
    }),
    // TIP: Add more providers here as needed like Apple, Facebook, etc.
  ],
});
