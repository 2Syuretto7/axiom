import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/lib/db/schema";
import { signUp } from "@/lib/auth/service";
import {
  completedConcepts,
  hintLevels,
  recordAttempt,
  revealNextHint,
  saveSnapshot,
  snapshotsFor,
  solvedQuestions,
} from "@/lib/learning/service";
import { migrate } from "../../scripts/migrate";

const url = process.env.TEST_DATABASE_URL ?? "postgres://axiom:axiom@localhost:5432/axiom_test";
const pool = new Pool({ connectionString: url });
const db = drizzle(pool, { schema });
let userId: string;

beforeAll(async () => {
  await migrate(url, () => {});
});
beforeEach(async () => {
  await pool.query("truncate users, sessions, login_attempts, attempts, hint_views, lesson_progress, code_snapshots restart identity cascade");
  const created = await signUp(db, "vitest");
  if (!created.ok) throw new Error("sign-up failed");
  userId = (await pool.query<{ id: string }>("select id from users")).rows[0].id;
});
afterAll(async () => {
  await pool.end();
});

const attempt = (conceptId: string, questionId: string, correct: boolean) =>
  recordAttempt(db, userId, { conceptId, questionId, system: "s1", correct, answer: "x", ms: 1200 }, ["a", "b"]);

describe("recording learning", () => {
  it("completes a lesson only when every question has been answered correctly", async () => {
    expect(await attempt("m0.counting", "a", false)).toEqual({ lessonComplete: false });
    expect(await attempt("m0.counting", "a", true)).toEqual({ lessonComplete: false });
    expect(await completedConcepts(db, userId)).toEqual([]);
    expect(await attempt("m0.counting", "b", true)).toEqual({ lessonComplete: true });
    expect(await solvedQuestions(db, userId, "m0.counting")).toEqual(new Set(["a", "b"]));
    expect(await completedConcepts(db, userId)).toEqual(["m0.counting"]);
  });

  it("lists completed lessons in the order they were finished", async () => {
    for (const concept of ["m0.counting", "e0.printing", "m0.adding"]) {
      await attempt(concept, "a", true);
      await attempt(concept, "b", true);
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    expect(await completedConcepts(db, userId)).toEqual(["m0.counting", "e0.printing", "m0.adding"]);
  });

  it("climbs the hint ladder one rung at a time and records hints against the attempt", async () => {
    expect(await revealNextHint(db, userId, "m0.counting", "a", 2)).toBe(1);
    expect(await revealNextHint(db, userId, "m0.counting", "a", 2)).toBe(2);
    expect(await revealNextHint(db, userId, "m0.counting", "a", 2)).toBe(2);
    expect(await hintLevels(db, userId, "m0.counting")).toEqual(new Map([["a", 2]]));
    await attempt("m0.counting", "a", true);
    expect((await pool.query("select hints_used from attempts")).rows[0].hints_used).toBe(2);
  });

  it("keeps the latest code for each editor document", async () => {
    await saveSnapshot(db, userId, "axiom-code:m0.counting", "print(1)");
    await saveSnapshot(db, userId, "axiom-code:m0.counting", "print(2)");
    await saveSnapshot(db, userId, "axiom-code:m0.counting:q", "x = 1");
    await saveSnapshot(db, userId, "axiom-code:m0.adding", "other");
    const found = await snapshotsFor(db, userId, "axiom-code:m0.counting");
    expect(Object.keys(found).sort()).toEqual(["axiom-code:m0.counting", "axiom-code:m0.counting:q"]);
    expect(found["axiom-code:m0.counting"].code).toBe("print(2)");
  });
});
