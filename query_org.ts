import { db } from "./src/db/index.js";
import { organizations } from "./src/db/schema/index.js";

async function main() {
    const orgs = await db.select().from(organizations);
    console.log(orgs);
}

main().catch(console.error);
