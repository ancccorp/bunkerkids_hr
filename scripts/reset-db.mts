// Deletes the local SQLite database; it is recreated with demo data on the next request.
import fs from "node:fs";
import path from "node:path";

const db = process.env.HR_DB_PATH ?? path.join(process.cwd(), "data", "hr.db");
for (const f of [db, `${db}-wal`, `${db}-shm`]) fs.rmSync(f, { force: true });
console.log(`Removed ${db}. Restart the dev server to reseed.`);
