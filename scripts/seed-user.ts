import "dotenv/config";
import { db } from "../src/db";
import { users } from "../src/db/schema/user";
import { hash } from "bcryptjs";

async function seedUser() {
  const email = "admin@fellowship360.com";
  const password = "Test1234!";
  const name = "Admin User";

  console.log("Creating test user...");

  // Hash the password
  const hashedPassword = await hash(password, 12);

  try {
    // Insert the user
    await db.insert(users).values({
      id: crypto.randomUUID(),
      email,
      name,
      password: hashedPassword,
      emailVerified: new Date(), // Mark as verified
    }).onConflictDoNothing();

    console.log("✅ Test user created successfully!");
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log("\nYou can now sign in at http://localhost:3002/sign-in");
  } catch (error) {
    console.error("Error creating user:", error);
  }

  process.exit(0);
}

seedUser();
