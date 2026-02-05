import "dotenv/config";
import { db } from "../src/db";
import { users } from "../src/db/schema/user";

async function checkUsers() {
  console.log("Checking users in database...");
  
  const allUsers = await db.select().from(users);
  
  console.log(`Found ${allUsers.length} users:`);
  allUsers.forEach(user => {
    console.log(`  - ${user.email} (id: ${user.id}, has password: ${!!user.password})`);
  });

  process.exit(0);
}

checkUsers();
