import { and, asc, eq, gt, isNotNull, isNull, lte, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { isCapstoneId } from "../capstones/schema";
import * as schema from "../db/schema";
import { gradeReview, reviewQuestion, type ReviewQuestion } from "./question";
import { afterReview, firstMemory, type Memory } from "./schedule";

type Db = NodePgDatabase<typeof schema>;
const { reviewStates, reviewQuestions, lessonProgress } = schema;

const memoryOf = (row: typeof reviewStates.$inferSelect): Memory => ({
  stability: row.stability,
  difficulty: row.difficulty,
  reps: row.reps,
  lapses: row.lapses,
  lastReviewedAt: row.lastReviewedAt,
  dueAt: row.dueAt,
});

/**
 * Gives every finished lesson a memory, dated from the moment it was finished.
 * Lessons finished before reviews existed are picked up the same way, so nothing has to be migrated.
 */
export async function rememberFinishedLessons(db: Db, userId: string) {
  const finished = await db
    .select({ id: lessonProgress.conceptId, at: lessonProgress.completedAt })
    .from(lessonProgress)
    .where(and(eq(lessonProgress.userId, userId), isNotNull(lessonProgress.completedAt)));
  const lessons = finished.filter((row) => !isCapstoneId(row.id));
  if (lessons.length === 0) return;
  await db
    .insert(reviewStates)
    .values(lessons.map((row) => ({ userId, conceptId: row.id, ...firstMemory(row.at!) })))
    .onConflictDoNothing();
}

/** Every lesson that is due at `at`, or will be by then. */
export async function dueBy(db: Db, userId: string, at: Date) {
  return db
    .select()
    .from(reviewStates)
    .where(and(eq(reviewStates.userId, userId), lte(reviewStates.dueAt, at)))
    .orderBy(asc(reviewStates.dueAt));
}

/** Whether the learner has begun a lesson or mini-capstone and not finished it. */
export async function unitStarted(db: Db, userId: string, unitId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: lessonProgress.conceptId })
    .from(lessonProgress)
    .where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.conceptId, unitId), isNull(lessonProgress.completedAt)));
  return Boolean(row);
}

/** Reviews answered since the learner last finished a lesson or a mini-capstone. */
export async function reviewsSinceLastUnit(db: Db, userId: string): Promise<number> {
  const [last] = await db
    .select({ at: sql<Date | null>`max(${lessonProgress.completedAt})` })
    .from(lessonProgress)
    .where(eq(lessonProgress.userId, userId));
  const [row] = await db
    .select({ count: sql<string>`count(*)` })
    .from(reviewQuestions)
    .where(
      and(eq(reviewQuestions.userId, userId), last?.at ? gt(reviewQuestions.answeredAt, new Date(last.at)) : isNotNull(reviewQuestions.answeredAt)),
    );
  return Number(row.count);
}

export type StoredQuestion = { id: number; conceptId: string; question: ReviewQuestion };

/** The question written for a lesson's next review and not yet answered, if there is one. */
export async function waitingQuestion(db: Db, userId: string, conceptId: string): Promise<StoredQuestion | null> {
  const [row] = await db
    .select({ id: reviewQuestions.id, conceptId: reviewQuestions.conceptId, question: reviewQuestions.question })
    .from(reviewQuestions)
    .where(and(eq(reviewQuestions.userId, userId), eq(reviewQuestions.conceptId, conceptId), isNull(reviewQuestions.answeredAt)));
  return row ? { ...row, question: reviewQuestion.parse(row.question) } : null;
}

/** Every review question ever written for a lesson, oldest first, with its fingerprint. */
export async function questionsWritten(db: Db, userId: string, conceptId: string) {
  const rows = await db
    .select({ question: reviewQuestions.question, fingerprint: reviewQuestions.fingerprint })
    .from(reviewQuestions)
    .where(and(eq(reviewQuestions.userId, userId), eq(reviewQuestions.conceptId, conceptId)))
    .orderBy(asc(reviewQuestions.id));
  return rows.map((row) => ({ question: reviewQuestion.parse(row.question), fingerprint: row.fingerprint }));
}

/**
 * Keeps a newly written question for the lesson's next review. Returns null if it
 * could not be kept: the same question was written before, or another one is already waiting.
 */
export async function keepQuestion(
  db: Db,
  userId: string,
  conceptId: string,
  written: { question: ReviewQuestion; fingerprint: string; costMicroUsd: number },
): Promise<StoredQuestion | null> {
  const [row] = await db
    .insert(reviewQuestions)
    .values({ userId, conceptId, question: written.question, fingerprint: written.fingerprint, costMicroUsd: written.costMicroUsd })
    .onConflictDoNothing()
    .returning({ id: reviewQuestions.id });
  return row ? { id: row.id, conceptId, question: written.question } : null;
}

export type ReviewOutcome = { correct: boolean; note?: string; question: ReviewQuestion; conceptId: string; nextDueAt: Date };

/**
 * Marks the one answer a review question gets, and moves the lesson's next review.
 * `read` turns what the browser sent into the question's own terms (an option's index, not its place on screen).
 * Returns null if the question is not this learner's or has been answered already.
 */
export async function answerReview(db: Db, userId: string, questionId: number,
  read: (question: ReviewQuestion) => unknown,
  ms: number | null,
  now = new Date(),
): Promise<ReviewOutcome | null> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(reviewQuestions)
      .where(and(eq(reviewQuestions.id, questionId), eq(reviewQuestions.userId, userId), isNull(reviewQuestions.answeredAt)))
      .for("update");
    if (!row) return null;
    const question = reviewQuestion.parse(row.question);
    const given = read(question);
    const verdict = gradeReview(question, given);
    // Something that is not an answer at all, such as letters where a number belongs, does not use up the one try.
    if (!verdict.correct && verdict.note) return { correct: false, note: verdict.note, question, conceptId: row.conceptId, nextDueAt: now };

    await tx
      .update(reviewQuestions)
      .set({
        answeredAt: now,
        correct: verdict.correct,
        answer: given ?? null,
        ms: ms === null ? null : Math.max(0, Math.min(Math.round(ms), 86_400_000)),
      })
      .where(eq(reviewQuestions.id, questionId));

    const key = and(eq(reviewStates.userId, userId), eq(reviewStates.conceptId, row.conceptId));
    const [state] = await tx.select().from(reviewStates).where(key).for("update");
    const before = state ? memoryOf(state) : firstMemory(row.createdAt);
    const after = afterReview(before, verdict.correct, now);
    await tx
      .insert(reviewStates)
      .values({ userId, conceptId: row.conceptId, ...after })
      .onConflictDoUpdate({ target: [reviewStates.userId, reviewStates.conceptId], set: after });
    return { correct: verdict.correct, question, conceptId: row.conceptId, nextDueAt: after.dueAt };
  });
}
