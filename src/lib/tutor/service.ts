import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../db/schema";

type Db = NodePgDatabase<typeof schema>;
const { tutorMessages, attempts } = schema;

export type TutorMessage = { id: number; role: "user" | "assistant"; content: string };

/** The conversation on one lesson, oldest first, at most `limit` of the latest messages. */
export async function tutorHistory(db: Db, userId: string, conceptId: string, limit = 60): Promise<TutorMessage[]> {
  const rows = await db
    .select({ id: tutorMessages.id, role: tutorMessages.role, content: tutorMessages.content })
    .from(tutorMessages)
    .where(and(eq(tutorMessages.userId, userId), eq(tutorMessages.conceptId, conceptId), isNull(tutorMessages.clearedAt)))
    .orderBy(desc(tutorMessages.id))
    .limit(limit);
  return rows.reverse();
}

export async function saveTutorMessage(
  db: Db,
  userId: string,
  conceptId: string,
  role: "user" | "assistant",
  content: string,
  costMicroUsd = 0,
): Promise<number> {
  const [row] = await db.insert(tutorMessages).values({ userId, conceptId, role, content, costMicroUsd }).returning({ id: tutorMessages.id });
  return row.id;
}

/** Hides the conversation on one lesson. The rows stay, so what was spent is still counted. */
export async function clearTutorHistory(db: Db, userId: string, conceptId: string) {
  await db
    .update(tutorMessages)
    .set({ clearedAt: sql`now()` })
    .where(and(eq(tutorMessages.userId, userId), eq(tutorMessages.conceptId, conceptId), isNull(tutorMessages.clearedAt)));
}


export type QuestionEffort = { tries: number; wrong: number; ms: number };

/** How hard each question of a lesson has been for the learner so far: attempts, wrong attempts and time spent. */
export async function questionEffort(db: Db, userId: string, conceptId: string): Promise<Map<string, QuestionEffort>> {
  const rows = await db
    .select({
      id: attempts.questionId,
      tries: sql<string>`count(*)`,
      wrong: sql<string>`count(*) filter (where not ${attempts.correct})`,
      ms: sql<string>`coalesce(sum(${attempts.ms}), 0)`,
    })
    .from(attempts)
    .where(and(eq(attempts.userId, userId), eq(attempts.conceptId, conceptId)))
    .groupBy(attempts.questionId);
  return new Map(rows.map((row) => [row.id, { tries: Number(row.tries), wrong: Number(row.wrong), ms: Number(row.ms) }]));
}
