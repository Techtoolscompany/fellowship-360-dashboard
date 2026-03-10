import { db } from "../src/db";
import { users } from "../src/db/schema/user";
import { eq } from "drizzle-orm";
import { verifyPassword } from "../src/lib/auth/password";

async function run() {
  const email = "admin@fellowship360.com";
  const password = "Test1234!";

  const user = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1)
    .then((rows) => rows[0]);

  if (!user) {
    console.log("NO_USER");
    return;
  }

  if (!user.password) {
    console.log("NO_PASSWORD");
    return;
  }

  const matches = await verifyPassword(password, user.password);
  console.log(matches ? "PASSWORD_MATCH" : "PASSWORD_NO_MATCH");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
