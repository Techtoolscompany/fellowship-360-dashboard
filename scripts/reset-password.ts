import "dotenv/config";
import { db } from "../src/db";
import { users } from "../src/db/schema/user";
import { hash, compare } from "bcryptjs";
import { eq } from "drizzle-orm";

async function resetPassword() {
  const email = "admin@example.com";
  const password = "Test1234!";

  console.log(`Resetting password for ${email}...`);

  const hashedPassword = await hash(password, 12);

  try {
    // Update the password
    await db.update(users)
      .set({ password: hashedPassword })
      .where(eq(users.email, email));

    // Verify the update took place
    const updatedUser = await db.select().from(users)
      .where(eq(users.email, email))
      .then(rows => rows[0]);

    console.log("✅ Password updated successfully!");
    console.log(`   Email: ${email}`);
    console.log(`   New Password: ${password}`);
    console.log(`   New Hash in DB: ${updatedUser?.password}`);
    
    // Quick verification check
    const isMatch = await compare(password, updatedUser?.password || "");
    console.log(`   Immediate verification: ${isMatch ? "SUCCESS" : "FAILED"}`);

    console.log("\nYou can now sign in at http://localhost:3002/sign-in");
  } catch (error) {
    console.error("Error updating password:", error);
  }

  process.exit(0);
}

resetPassword();
