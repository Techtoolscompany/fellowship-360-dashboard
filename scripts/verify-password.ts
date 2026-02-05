import "dotenv/config";
import { db } from "../src/db";
import { users } from "../src/db/schema/user";
import { eq } from "drizzle-orm";
import { verifyPassword } from "../src/lib/auth/password";
import bcrypt from "bcryptjs";

async function verifyUser() {
  const email = "admin@example.com";
  const password = "Test1234!";

  console.log(`Verifying password for ${email}...`);

  const user = await db.select().from(users)
    .where(eq(users.email, email))
    .then(rows => rows[0]);

  if (!user) {
    console.error("❌ User not found!");
    process.exit(1);
  }

  console.log("User found:", { email: user.email, id: user.id });
  console.log("Stored hash:", user.password);

  if (!user.password) {
    console.error("❌ No password set for user!");
    process.exit(1);
  }

  // Test 1: Compare using the helper
  const matchHelper = await verifyPassword(password, user.password);
  console.log(`verifyPassword(password, hash): ${matchHelper}`);

  // Test 2: Compare directly
  const matchDirect = await bcrypt.compare(password, user.password);
  console.log(`bcrypt.compare(password, hash): ${matchDirect}`);
  
  // Test 3: Compare with a wrong password
  const matchWrong = await bcrypt.compare("wrong", user.password);
  console.log(`bcrypt.compare("wrong", hash): ${matchWrong}`);

  if (matchHelper && matchDirect) {
    console.log("✅ Password setup is CORRECT in the database.");
  } else {
    console.error("❌ Password verification FAILED with the database hash.");
  }

  process.exit(0);
}

verifyUser();
