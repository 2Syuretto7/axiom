"use server";

import { getCurrentUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { renderReply, renderReplyInline } from "@/lib/tutor/render";
import { optionOrder, type ReviewQuestion } from "./question";
import { answerReview } from "./service";

export type ReviewResult = {
  correct: boolean;
  /** Set when what was typed is not an answer at all. The one try is not used up. */
  note?: string;
  explanationHtml?: string;
  /** The right answer, shown after a miss. */
  answerHtml?: string;
  /** Whole days until this lesson is reviewed again. */
  nextInDays?: number;
};

const escape = (text: string) => text.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);

/** Marks the one answer a review question gets and schedules the lesson's next review. */
export async function submitReview(questionId: number, answer: unknown, ms: number): Promise<ReviewResult> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Signed out");
  const id = Number(questionId);
  if (!Number.isSafeInteger(id)) throw new Error("Unknown question");

  // The browser speaks in screen positions for options; the server holds the order.
  const read = (question: ReviewQuestion) =>
    question.type === "choice" ? (typeof answer === "number" ? optionOrder(question, `review:${id}`)[answer] : undefined) : String(answer ?? "").slice(0, 4000);

  const now = new Date();
  const outcome = await answerReview(getDb(), user.id, id, read, typeof ms === "number" ? ms : null, now);
  if (!outcome) throw new Error("Unknown question");
  if (outcome.note) return { correct: false, note: outcome.note };
  const q = outcome.question;
  const answerHtml =
    q.type === "numeric"
      ? escape(`${q.answer}${q.unit ? ` ${q.unit}` : ""}`)
      : q.type === "choice"
        ? renderReplyInline(q.options[q.answer])
        : `<pre class="q-code"><code>${escape(q.output)}</code></pre>`;
  return {
    correct: outcome.correct,
    explanationHtml: renderReply(q.explanation),
    answerHtml: outcome.correct ? undefined : answerHtml,
    nextInDays: Math.max(1, Math.round((outcome.nextDueAt.getTime() - now.getTime()) / 86_400_000)),
  };
}
