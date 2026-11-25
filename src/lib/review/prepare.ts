import "server-only";
import type { Db } from "../db";
import { content } from "../lessons/content";
import { questionsOf } from "../lessons/load";
import { tutorConnected } from "../tutor/config";
import { writeReviewQuestion } from "./generate";
import { askModel } from "./model";
import { fingerprint, summary } from "./question";
import { keepQuestion, questionsWritten, waitingQuestion, type StoredQuestion } from "./service";

const running = new Map<string, Promise<StoredQuestion | null>>();

/**
 * The question for a lesson's next review: the one already waiting, or a new one
 * written now. Returns null when no new question could be written, for example
 * when the model is not connected. A review never falls back to an old question.
 */
export function prepareQuestion(db: Db, userId: string, conceptId: string): Promise<StoredQuestion | null> {
  const key = `${userId}:${conceptId}`;
  const existing = running.get(key);
  if (existing) return existing;
  const work = (async () => {
    const waiting = await waitingQuestion(db, userId, conceptId);
    if (waiting) return waiting;
    const { graph, lessons } = content();
    const lesson = lessons.get(conceptId);
    if (!lesson || !tutorConnected()) return null;
    const written = await questionsWritten(db, userId, conceptId);
    const taken = new Set([...written.map((row) => row.fingerprint), ...questionsOf(lesson).map(fingerprint)]);
    const fresh = await writeReviewQuestion({ graph, lesson, earlier: written.map((row) => summary(row.question)), taken }, askModel);
    if (!fresh.question) return null;
    // If another server instance wrote one in the meantime, that one is used and this one is dropped.
    return (await keepQuestion(db, userId, conceptId, fresh)) ?? (await waitingQuestion(db, userId, conceptId));
  })()
    .catch((error) => {
      console.error("review", error instanceof Error ? error.name : "error");
      return null;
    })
    .finally(() => running.delete(key));
  running.set(key, work);
  return work;
}
