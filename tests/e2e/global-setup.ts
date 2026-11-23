import { Client } from "pg";
import { migrate } from "../../scripts/migrate";

/** Every local run starts from an empty database: no learner, no sessions. */
export default async function globalSetup() {
  const url = process.env.E2E_DATABASE_URL ?? "postgres://axiom:axiom@localhost:5432/axiom_e2e";
  if (!/localhost|127\.0\.0\.1/.test(url)) throw new Error("Refusing to reset a database that is not local.");
  await migrate(url, () => {});
  const client = new Client({ connectionString: url });
  await client.connect();
  await client.query("truncate users, sessions, login_attempts, attempts, hint_views, lesson_progress, code_snapshots restart identity cascade");
  await client.end();
}
