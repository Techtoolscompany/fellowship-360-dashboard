import "dotenv/config";
import { db } from "../src/db";
import { users } from "../src/db/schema/user";
import { organizations } from "../src/db/schema/organization";
import { organizationMemberships } from "../src/db/schema/organization-membership";
import { hash } from "bcryptjs";
import { seedDemoData } from "../src/app/actions/seed";
import { eq, and } from "drizzle-orm";

async function seedFull() {
  console.log("🌱 Starting full seed process...");

  // 1. Create/Get User
  const email = "admin@fellowship360.com";
  const password = "Test1234!";
  const name = "Admin User";
  let userId: string;

  console.log(`\n👤 Checking user: ${email}`);
  const [existingUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (existingUser) {
    console.log("   User already exists.");
    userId = existingUser.id;
  } else {
    console.log("   Creating new user...");
    const hashedPassword = await hash(password, 12);
    const [newUser] = await db.insert(users).values({
      id: crypto.randomUUID(),
      email,
      name,
      password: hashedPassword,
      emailVerified: new Date(),
    }).returning();
    userId = newUser.id;
    console.log("   User created.");
  }

  // 2. Create/Get Organization
  const orgName = "Fellowship 360 Demo";
  const orgSlug = "fellowship-360-demo";
  let orgId: string;

  console.log(`\n🏢 Checking organization: ${orgName}`);
  const [existingOrg] = await db.select().from(organizations).where(eq(organizations.slug, orgSlug)).limit(1);

  if (existingOrg) {
    console.log("   Organization already exists.");
    orgId = existingOrg.id;
  } else {
    console.log("   Creating new organization...");
    const [newOrg] = await db.insert(organizations).values({
      id: crypto.randomUUID(),
      name: orgName,
      slug: orgSlug,
      createdAt: new Date(),
      updatedAt: new Date(),
      onboardingDone: true,
    }).returning();
    orgId = newOrg.id;
    console.log("   Organization created.");
  }

  // 3. Create/Get Membership
  console.log(`\n🔗 Checking membership...`);
  const [existingMembership] = await db.select().from(organizationMemberships).where(
    and(
      eq(organizationMemberships.userId, userId),
      eq(organizationMemberships.organizationId, orgId)
    )
  ).limit(1);

  if (existingMembership) {
    console.log("   Membership already exists.");
  } else {
    console.log("   Creating membership (admin)...");
    await db.insert(organizationMemberships).values({
      userId,
      organizationId: orgId,
      role: "admin", // correctly typed from enum
    });
    console.log("   Membership created.");
  }

  // 4. Seed Demo Data
  console.log(`\n📊 Seeding demo data for organization...`);
  try {
    const result = await seedDemoData(orgId);
    if (result.success) {
      console.log(`✅ Demo data seeded successfully! (${result.contactCount} contacts created)`);
    } else {
      console.log(`⚠️ Demo data seeding returned logic false.`);
    }
  } catch (error) {
    console.error("❌ Error seeding demo data:", error);
  }

  console.log("\n✅ FULL SEED COMPLETE!");
  console.log("-----------------------------------------");
  console.log(`Email:    ${email}`);
  console.log(`Password: ${password}`);
  console.log(`Login:    http://localhost:3001/sign-in`);
  console.log("-----------------------------------------");

  process.exit(0);
}

seedFull().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
