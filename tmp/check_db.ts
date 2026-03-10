import { db } from "../src/db";
import { churchContacts } from "../src/db/schema";
import { desc } from "drizzle-orm";

async function main() {
  const contacts = await db.select().from(churchContacts).orderBy(desc(churchContacts.createdAt)).limit(5);
  console.log("Recent contacts:");
  console.log(JSON.stringify(contacts, null, 2));
  process.exit(0);
}
main().catch(console.error);
