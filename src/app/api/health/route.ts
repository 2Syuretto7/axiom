import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

/** Used by the post-deploy smoke test: proves the app can reach its database. */
export async function GET() {
  try {
    await getDb().execute(sql`select 1`);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
