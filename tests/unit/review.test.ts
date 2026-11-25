import { randomUUID } from "node:crypto";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/lib/db/schema";
import { signUp } from "@/lib/auth/service";
import { loadGraph } from "@/lib/graph/load";
import { recordAttempt } from "@/lib/learning/service";
import { loadLessons, questionsOf } from "@/lib/lessons/load";
import { agrees, forChecker, fromDraft, reviewSystem, writeReviewQuestion, type Ask } from "@/lib/review/generate";
import { fingerprint, gradeReview, summary, type ReviewQuestion } from "@/lib/review/question";
import {
  afterReview,
  firstMemory,
  intervalDays,
  pickReview,
  recallChance,
  reviewQueue,
  REVIEWS_BETWEEN_UNITS,
  TARGET_RECALL,
  type Memory,
} from "@/lib/review/schedule";
import { answerReview, dueBy, keepQuestion, questionsWritten, rememberFinishedLessons, reviewsSinceLastUnit, unitStarted, waitingQuestion } from "@/lib/review/service";
import { migrate } from "../../scripts/migrate";

const DAY = 86_400_000;
const T0 = new Date("2026-01-01T00:00:00Z");
const later = (from: Date, days: number) => new Date(from.getTime() + days * DAY);
const gap = (memory: Memory) => (memory.dueAt.getTime() - memory.lastReviewedAt.getTime()) / DAY;

describe("the schedule", () => {
  it("brings a lesson back when the chance of recalling it has fallen to the target", () => {
    const memory = firstMemory(T0);
    expect(gap(memory)).toBeGreaterThan(2);
    expect(gap(memory)).toBeLessThan(7);
    expect(recallChance(memory.stability, 0)).toBe(1);
    expect(recallChance(memory.stability, gap(memory))).toBeCloseTo(TARGET_RECALL, 6);
    expect(recallChance(memory.stability, 30)).toBeLessThan(recallChance(memory.stability, 10));
  });

  it("widens the gap after every review that is recalled", () => {
    let memory = firstMemory(T0);
    const gaps = [gap(memory)];
    for (let i = 0; i < 4; i++) {
      memory = afterReview(memory, true, memory.dueAt);
      gaps.push(gap(memory));
    }
    for (let i = 1; i < gaps.length; i++) expect(gaps[i]).toBeGreaterThan(gaps[i - 1] * 1.3);
    expect(memory.reps).toBe(4);
    expect(memory.lapses).toBe(0);
    expect(gaps.at(-1)).toBeGreaterThan(100);
    // Left alone, the gaps settle at the longest allowed.
    for (let i = 0; i < 6; i++) memory = afterReview(memory, true, memory.dueAt);
    expect(gap(memory)).toBe(365);
  });

  it("brings a missed lesson back sooner, and makes it harder", () => {
    let memory = firstMemory(T0);
    for (let i = 0; i < 4; i++) memory = afterReview(memory, true, memory.dueAt);
    const missed = afterReview(memory, false, memory.dueAt);
    expect(gap(missed)).toBeLessThan(gap(memory) / 3);
    expect(gap(missed)).toBeGreaterThanOrEqual(1);
    expect(missed.difficulty).toBeGreaterThan(memory.difficulty);
    expect(missed.lapses).toBe(1);
    // It then recovers more slowly than a lesson that was never missed.
    const recovered = afterReview(missed, true, missed.dueAt);
    expect(gap(recovered)).toBeGreaterThan(gap(missed));
    expect(gap(recovered)).toBeLessThan(gap(memory));
  });

  it("rewards a lesson that was recalled late more than one recalled early", () => {
    const memory = afterReview(firstMemory(T0), true, later(T0, 4));
    const early = afterReview(memory, true, later(memory.lastReviewedAt, 1));
    const onTime = afterReview(memory, true, memory.dueAt);
    const late = afterReview(memory, true, later(memory.dueAt, 20));
    expect(early.stability).toBeLessThan(onTime.stability);
    expect(onTime.stability).toBeLessThan(late.stability);
    expect(early.stability).toBeGreaterThan(memory.stability);
  });

  it("never schedules closer than a day or further than a year", () => {
    expect(intervalDays(0.1)).toBe(1);
    expect(intervalDays(5000)).toBe(365);
  });

  it("gives reviews only between units, a few at a time, most forgotten first", () => {
    const now = later(T0, 40);
    const fresh = { conceptId: "c.fresh", ...firstMemory(later(T0, 39)) };
    const stale = { conceptId: "a.stale", ...firstMemory(T0) };
    const staler = { conceptId: "b.staler", ...firstMemory(later(T0, -200)) };
    const all = [fresh, stale, staler];
    const between = { unitWaiting: true, unitStarted: false, reviewsSinceUnit: 0 };
    expect(reviewQueue(all, now)).toEqual(["b.staler", "a.stale"]);
    expect(pickReview(all, now, between)).toBe("b.staler");
    expect(pickReview([fresh], now, between)).toBeNull();
    // Never in the middle of a lesson.
    expect(pickReview(all, now, { ...between, unitStarted: true })).toBeNull();
    // A backlog does not block new material, but when nothing new is waiting every due review is given.
    expect(pickReview(all, now, { ...between, reviewsSinceUnit: REVIEWS_BETWEEN_UNITS })).toBeNull();
    expect(pickReview(all, now, { unitWaiting: false, unitStarted: false, reviewsSinceUnit: 50 })).toBe("b.staler");
  });
});

const numeric: ReviewQuestion = { type: "numeric", prompt: "A tray holds 4 rows of 6 eggs. How many eggs?", explanation: "Four sixes are 24.", answer: "24" };
const choice: ReviewQuestion = {
  type: "choice",
  prompt: "Which is largest?",
  explanation: "Compare them one at a time.",
  options: ["12", "21", "19"],
  answer: 1,
};

describe("review questions", () => {
  it("are marked by the same rules as lesson questions", () => {
    expect(gradeReview(numeric, "24").correct).toBe(true);
    expect(gradeReview(numeric, "48/2").correct).toBe(true);
    expect(gradeReview(numeric, "25").correct).toBe(false);
    expect(gradeReview(numeric, "two dozen").note).toBeTruthy();
    expect(gradeReview(choice, 1).correct).toBe(true);
    expect(gradeReview(choice, 0).correct).toBe(false);
    expect(gradeReview({ type: "predict", prompt: "What is printed?", explanation: "It adds.", code: "print(2 + 3)", output: "5" }, "5 \n").correct).toBe(true);
  });

  it("count as the same question however they are laid out, and as different when they ask something else", () => {
    const same = { ...numeric, prompt: "  a tray holds 4 rows of 6 eggs.\nHow many eggs" };
    expect(fingerprint(same)).toBe(fingerprint(numeric));
    expect(fingerprint({ ...numeric, prompt: "A tray holds 4 rows of 7 eggs. How many eggs?" })).not.toBe(fingerprint(numeric));
    expect(fingerprint({ ...choice, options: ["19", "12", "21"] })).toBe(fingerprint(choice));
    expect(fingerprint({ ...choice, options: ["12", "21", "20"] })).not.toBe(fingerprint(choice));
    expect(summary(choice)).toContain("12 | 21 | 19");
  });
});

const fixtures = path.resolve(import.meta.dirname, "..", "fixtures");
const graph = loadGraph(path.join(fixtures, "graph"));
const lesson = loadLessons(path.join(fixtures, "content", "lessons")).get("m0.counting")!;

const draft = (over: Partial<Parameters<typeof fromDraft>[0]> = {}) => ({
  type: "numeric" as const,
  prompt: "Seven goats are in the pen and two walk out. How many are left?",
  code: "",
  options: [],
  answer: "5",
  tolerance: "",
  unit: "goats",
  explanation: "Take two away from seven.",
  ...over,
});

/** Stands in for the model: answers each request from a script, and records what it was sent. */
function scripted(replies: unknown[]) {
  const sent: { system: string; message: string }[] = [];
  const ask: Ask = async (system, message, shape) => {
    sent.push({ system, message });
    const parsed = shape.safeParse(replies.shift());
    return { value: parsed.success ? parsed.data : null, costMicroUsd: 100 };
  };
  return { ask, sent };
}

describe("writing a fresh question", () => {
  const input = { graph, lesson, earlier: [] as string[], taken: new Set(questionsOf(lesson).map(fingerprint)) };

  it("turns what the writer sent into a question, and refuses one that does not hold together", () => {
    expect(fromDraft(draft())).toEqual({ type: "numeric", prompt: draft().prompt, explanation: "Take two away from seven.", answer: "5", unit: "goats" });
    expect(fromDraft(draft({ answer: "five" }))).toBeNull();
    expect(fromDraft(draft({ type: "choice", options: ["4", "5", "9"], answer: "5" }))).toMatchObject({ type: "choice", answer: 1 });
    // The stated answer must be one of the options, and options may not repeat.
    expect(fromDraft(draft({ type: "choice", options: ["4", "6", "9"], answer: "5" }))).toBeNull();
    expect(fromDraft(draft({ type: "choice", options: ["5", "5", "9"], answer: "5" }))).toBeNull();
    expect(fromDraft(draft({ type: "predict", code: "print(7 - 2)", answer: "5" }))).toMatchObject({ type: "predict", output: "5" });
    expect(fromDraft(draft({ type: "predict", code: "", answer: "5" }))).toBeNull();
  });

  it("shows the checker the question without its answer", () => {
    const shown = forChecker(fromDraft(draft({ type: "choice", options: ["4", "5", "9"], answer: "5" }))!);
    expect(shown).toContain("- 4");
    expect(shown).not.toContain("Take two away");
    expect(forChecker(fromDraft(draft())!)).not.toMatch(/\b5\b/);
  });

  it("keeps a question only when an independent check reaches the same answer", async () => {
    const good = scripted([draft(), { sound: true, problem: "", answer: "5" }]);
    const written = await writeReviewQuestion(input, good.ask);
    expect(written.question).toMatchObject({ type: "numeric", answer: "5" });
    expect(written.costMicroUsd).toBe(200);
    // Both requests carry the lesson, and the checker is not told the answer.
    expect(good.sent[0].system).toBe(reviewSystem(graph, lesson));
    expect(good.sent[0].system).toContain("Lesson: Counting");
    expect(good.sent[0].message).toContain("None yet.");
    expect(good.sent[1].message).toContain("Seven goats");
    expect(good.sent[1].message).not.toContain("Take two away");

    // The checker got a different answer the first time, so that question is thrown away and another is written.
    const second = draft({ prompt: "Nine goats, three leave. How many stay?", answer: "6" });
    const retried = scripted([draft({ answer: "4" }), { sound: true, problem: "", answer: "5" }, second, { sound: true, problem: "", answer: "6" }]);
    expect((await writeReviewQuestion(input, retried.ask)).question).toMatchObject({ prompt: second.prompt });

    const unsound = scripted([draft(), { sound: false, problem: "Two readings.", answer: "5" }, draft(), { sound: false, problem: "Two readings.", answer: "5" }]);
    expect((await writeReviewQuestion(input, unsound.ask)).question).toBeNull();
    expect(agrees(fromDraft(draft())!, { sound: true, problem: "", answer: "10/2" })).toBe(true);
  });

  it("never returns a question that was asked before, in a review or in the lesson", async () => {
    const before = fromDraft(draft())!;
    const repeat = scripted([draft({ prompt: "seven goats are in the pen, and two walk out; how many are left" }), draft()]);
    const result = await writeReviewQuestion({ ...input, earlier: [summary(before)], taken: new Set([fingerprint(before)]) }, repeat.ask);
    expect(result.question).toBeNull();
    // The writer was shown what had been asked, and the repeats never reached the checker.
    expect(repeat.sent).toHaveLength(2);
    expect(repeat.sent[0].message).toContain("Seven goats are in the pen");

    const own = questionsOf(lesson).find((q) => q.type === "numeric")!;
    const copied = scripted([draft({ prompt: own.prompt }), draft({ prompt: own.prompt })]);
    expect((await writeReviewQuestion(input, copied.ask)).question).toBeNull();
  });
});

const url = process.env.TEST_DATABASE_URL ?? "postgres://axiom:axiom@localhost:5432/axiom_test";
const pool = new Pool({ connectionString: url });
const db = drizzle(pool, { schema });
let userId: string;

beforeAll(async () => {
  await migrate(url, () => {});
});
beforeEach(async () => {
  await pool.query("truncate users, sessions, login_attempts, attempts, lesson_progress, code_snapshots restart identity cascade");
  const created = await signUp(db, "vitest");
  if (!created.ok) throw new Error("sign-up failed");
  userId = (await pool.query<{ id: string }>("select id from users")).rows[0].id;
});
afterAll(async () => {
  await pool.end();
});

const finish = async (conceptId: string, daysAgo: number) => {
  await recordAttempt(db, userId, { conceptId, questionId: "a", system: "s1", correct: true, answer: "x", ms: 1 }, ["a"]);
  await pool.query("update lesson_progress set completed_at = now() - make_interval(days => $1) where concept_id = $2", [daysAgo, conceptId]);
};
const write = (q: ReviewQuestion) => ({ question: q, fingerprint: fingerprint(q), costMicroUsd: 7 });

describe("reviews in the database", () => {
  it("remembers every finished lesson from the day it was finished, but not mini-capstones", async () => {
    await finish("m0.counting", 30);
    await finish("m0.adding", 1);
    await finish("capstone.m0", 30);
    await rememberFinishedLessons(db, userId);
    await rememberFinishedLessons(db, userId);
    const now = new Date();
    expect((await dueBy(db, userId, now)).map((m) => m.conceptId)).toEqual(["m0.counting"]);
    expect((await dueBy(db, userId, later(now, 10))).map((m) => m.conceptId)).toEqual(["m0.counting", "m0.adding"]);
  });

  it("knows whether a unit has been started, and counts reviews since the last one was finished", async () => {
    await finish("m0.counting", 30);
    await recordAttempt(db, userId, { conceptId: "m0.adding", questionId: "a", system: "s1", correct: false, answer: "x", ms: 1 }, ["a"]);
    expect(await unitStarted(db, userId, "m0.adding")).toBe(true);
    expect(await unitStarted(db, userId, "m0.counting")).toBe(false);
    expect(await unitStarted(db, userId, "e0.printing")).toBe(false);

    await rememberFinishedLessons(db, userId);
    expect(await reviewsSinceLastUnit(db, userId)).toBe(0);
    const kept = await keepQuestion(db, userId, "m0.counting", write(numeric));
    await answerReview(db, userId, kept!.id, () => "24", 900);
    expect(await reviewsSinceLastUnit(db, userId)).toBe(1);
    await finish("m0.adding", 0);
    expect(await reviewsSinceLastUnit(db, userId)).toBe(0);
  });

  it("stores each question once, serves it once, and moves the next review", async () => {
    await finish("m0.counting", 30);
    await rememberFinishedLessons(db, userId);
    const [before] = await dueBy(db, userId, new Date());

    const kept = await keepQuestion(db, userId, "m0.counting", write(numeric));
    expect(await waitingQuestion(db, userId, "m0.counting")).toEqual(kept);
    // Only one question waits at a time.
    expect(await keepQuestion(db, userId, "m0.counting", write(choice))).toBeNull();

    // Letters where a number belongs are not an answer, so the one try is kept.
    expect(await answerReview(db, userId, kept!.id, () => "two dozen", 500)).toMatchObject({ correct: false, note: expect.any(String) });
    expect(await waitingQuestion(db, userId, "m0.counting")).not.toBeNull();

    const outcome = await answerReview(db, userId, kept!.id, () => "24", 1500);
    expect(outcome).toMatchObject({ correct: true, conceptId: "m0.counting" });
    expect(outcome!.nextDueAt.getTime()).toBeGreaterThan(Date.now() + 10 * DAY);
    expect(await dueBy(db, userId, new Date())).toEqual([]);
    const [after] = await dueBy(db, userId, later(new Date(), 400));
    expect(after.stability).toBeGreaterThan(before.stability);
    expect(after.reps).toBe(1);

    // Answered once: it is gone for good, cannot be answered again, and can never be written again.
    expect(await waitingQuestion(db, userId, "m0.counting")).toBeNull();
    expect(await answerReview(db, userId, kept!.id, () => "24", 1500)).toBeNull();
    expect(await keepQuestion(db, userId, "m0.counting", write({ ...numeric, prompt: "a tray holds 4 rows of 6 eggs, how many eggs" }))).toBeNull();
    expect(await keepQuestion(db, userId, "m0.counting", write(choice))).not.toBeNull();
    expect((await questionsWritten(db, userId, "m0.counting")).map((row) => row.question.type)).toEqual(["numeric", "choice"]);
  });

  it("brings a missed lesson back within days, and keeps other learners' questions out of reach", async () => {
    await finish("m0.counting", 60);
    await rememberFinishedLessons(db, userId);
    const kept = await keepQuestion(db, userId, "m0.counting", write(choice));
    const other = randomUUID();
    expect(await answerReview(db, other, kept!.id, () => 1, 100)).toBeNull();

    const outcome = await answerReview(db, userId, kept!.id, () => 0, 100);
    expect(outcome!.correct).toBe(false);
    expect(outcome!.nextDueAt.getTime()).toBeLessThan(Date.now() + 4 * DAY);
    const [state] = await dueBy(db, userId, later(new Date(), 400));
    expect(state.lapses).toBe(1);
  });
});
