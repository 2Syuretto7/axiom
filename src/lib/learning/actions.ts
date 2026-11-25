"use server";

import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { blockHtml, displayOrder, findQuestion } from "@/lib/lessons/content";
import { grade } from "@/lib/lessons/grade";
import { recordAttempt, saveSnapshot } from "./service";
import { clearTutorHistory } from "../tutor/service";

export type AnswerResult = { correct: boolean; note?: string; explanationHtml?: string; lessonComplete: boolean };

async function learner() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Signed out");
  return user;
}

const clean = (value: unknown, max: number) => String(value ?? "").slice(0, max);

/** Grades a numeric, choice, predict or order answer on the server and records the attempt. */
export async function submitAnswer(conceptId: string, questionId: string, answer: unknown, ms: number): Promise<AnswerResult> {
  const user = await learner();
  const { unitId, questions, question } = findQuestion(clean(conceptId, 200), clean(questionId, 200));
  if (question.type === "code") throw new Error("Code answers are checked by their tests");

  // The browser speaks in screen positions; translate them back to the lesson's own order.
  const order = displayOrder(unitId, question);
  let given: unknown = answer;
  if (question.type === "choice") given = typeof answer === "number" ? order[answer] : undefined;
  else if (question.type === "order") given = Array.isArray(answer) ? answer.slice(0, 8).map((position) => order[Number(position)]) : undefined;
  else given = clean(answer, 4000);

  const verdict = grade(question, given);
  const { lessonComplete } = await recordAttempt(
    getDb(),
    user.id,
    { conceptId: unitId, questionId: question.id, system: question.system, correct: verdict.correct, answer: given ?? null, ms },
    questions.map((q) => q.id),
  );
  return {
    correct: verdict.correct,
    note: verdict.note,
    explanationHtml: verdict.correct ? blockHtml(question.explanation) : undefined,
    lessonComplete,
  };
}

/** The checks for a code question. They run in the learner's browser, next to their code. */
export async function codeTests(conceptId: string, questionId: string): Promise<string> {
  await learner();
  const { question } = findQuestion(clean(conceptId, 200), clean(questionId, 200));
  if (question.type !== "code") throw new Error("Not a code question");
  return question.tests;
}

/** Records the outcome of running a code question's checks. */
export async function reportCode(conceptId: string, questionId: string, passed: boolean, code: string, ms: number): Promise<AnswerResult> {
  const user = await learner();
  const { unitId, questions, question } = findQuestion(clean(conceptId, 200), clean(questionId, 200));
  if (question.type !== "code") throw new Error("Not a code question");
  const { lessonComplete } = await recordAttempt(
    getDb(),
    user.id,
    { conceptId: unitId, questionId: question.id, system: question.system, correct: passed === true, answer: clean(code, 50_000), ms },
    questions.map((q) => q.id),
  );
  return { correct: passed === true, explanationHtml: passed === true ? blockHtml(question.explanation) : undefined, lessonComplete };
}

export async function saveCode(key: string, code: string): Promise<void> {
  const user = await learner();
  await saveSnapshot(getDb(), user.id, clean(key, 300), clean(code, 50_000));
}

/** Starts the tutor's conversation on a lesson afresh. */
export async function clearTutor(conceptId: string): Promise<void> {
  const user = await learner();
  await clearTutorHistory(getDb(), user.id, clean(conceptId, 200));
}
