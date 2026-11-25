"use server";

import { getCurrentUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { late } from "../lessons/timing";
import { optionOrder, type ReviewQuestion } from "./question";
import { answerReview } from "./service";
import { orderSeed, reveal, type Revealed } from "./view";

export type RecallResult =
  /** What was typed is not an answer at all. The one try is not used up. */
  | { note: string }
  | (Revealed & { note?: undefined; /** Whole days until this idea is recalled again. */ nextInDays: number });

/** Marks the one answer a fresh recall question gets, and sets when its idea is next recalled. */
export async function submitRecall(questionId: number, answer: unknown, ms: number): Promise<RecallResult> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Signed out");
  const id = Number(questionId);
  if (!Number.isSafeInteger(id)) throw new Error("Unknown question");

  // The browser speaks in screen positions for options; the server holds the order.
  const read = (question: ReviewQuestion) =>
    question.type === "choice" ? (typeof answer === "number" ? optionOrder(question, orderSeed(id))[answer] : undefined) : String(answer ?? "").slice(0, 4000);

  // Recall is fast retrieval (System One), so every fresh recall question is timed.
  const taken = typeof ms === "number" && Number.isFinite(ms) ? ms : null;
  const isLate = (question: ReviewQuestion) => late({ system: "s1", type: question.type }, taken ?? Infinity);
  const now = new Date();
  const outcome = await answerReview(getDb(), user.id, id, read, taken, now, isLate);
  if (!outcome) throw new Error("Unknown question");
  if (outcome.note) return { note: outcome.note };
  return {
    ...reveal(outcome.question, outcome.conceptId, outcome.correct),
    nextInDays: Math.max(1, Math.round((outcome.nextDueAt.getTime() - now.getTime()) / 86_400_000)),
  };
}
