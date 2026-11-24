import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/lib/db/schema";
import { signUp } from "@/lib/auth/service";
import { loadGraph } from "@/lib/graph/load";
import { loadLessons } from "@/lib/lessons/load";
import { costMicroUsd, tutorEffort, tutorModel } from "@/lib/tutor/config";
import { systemPrompt, workspaceNote } from "@/lib/tutor/prompt";
import { renderReply } from "@/lib/tutor/render";
import { recordAttempt } from "@/lib/learning/service";
import { clearTutorHistory, questionEffort, saveTutorMessage, tutorHistory } from "@/lib/tutor/service";
import { migrate } from "../../scripts/migrate";

const root = path.join(import.meta.dirname, "..", "fixtures");
const graph = loadGraph(path.join(root, "graph"));
const lessons = loadLessons(path.join(root, "content", "lessons"));

describe("what the tutor is told", () => {
  it("places the learner: finished lessons, the lesson in progress and what comes next", () => {
    const text = systemPrompt({ graph, completed: ["m0.counting"], lesson: lessons.get("m0.adding")!, next: "e0.printing" });
    expect(text).toContain("Feynman");
    expect(text).toMatch(/# Finished\n- Mathematics, .*: Counting/);
    expect(text).toContain("Lesson: Adding (Mathematics,");
    expect(text).toContain("Finished just before it: Counting");
    expect(text).toContain("Comes next: Printing");
    // Lessons are named by title; a concept id never reaches the model.
    expect(text).not.toMatch(/\[\[[a-z0-9.-]+\]\]/);
  });

  it("gives the whole lesson, with answers the tutor is told to keep to itself", () => {
    const text = systemPrompt({ graph, completed: [], lesson: lessons.get("m0.counting")!, next: "m0.adding" });
    expect(text).toContain("None yet. This is the learner's very first lesson");
    expect(text).toContain("A shepherd has no words for numbers.");
    expect(text).toContain("Question 1 (id pebbles, numeric):");
    expect(text).toContain("Answer: 9 sheep");
    expect(text).toContain("never state the answer");
    expect(text).toContain("Next comes Adding");
  });

  it("is identical from one question to the next, so it can be cached", () => {
    const build = () => systemPrompt({ graph, completed: ["m0.counting"], lesson: lessons.get("m0.adding")!, next: "e0.printing" });
    expect(build()).toBe(build());
  });

  it("still works when every written lesson is finished", () => {
    const text = systemPrompt({ graph, completed: [...lessons.keys()], lesson: null, next: null });
    expect(text).toContain("finished every lesson written so far");
    expect(text).toContain("Counting");
  });

  it("describes the screen: progress, the open question, the code and its output", () => {
    const lesson = lessons.get("e0.printing")!;
    const note = workspaceNote(lesson, { questionId: "write-sum", code: "print(1 + 2)\n", output: "3", solved: ["predict-fast"] });
    expect(note).toMatch(/^<workspace>\nQuestions solved so far: \d+ of \d+\./);
    expect(note).toMatch(/attempt at question \d+ \(not solved yet\)/);
    expect(note).toContain("print(1 + 2)");
    expect(note).toContain("Output of the last run:");
    const stuck = workspaceNote(lesson, {
      effort: new Map([["write-sum", { tries: 4, wrong: 4, ms: 420_000 }]]),
      hints: new Map([["write-sum", 1]]),
    });
    expect(stuck).toMatch(/Question \d+: not solved; 4 attempts, 4 wrong; 7 min spent; 1 of \d+ hints seen\./);
    expect(workspaceNote(null, {})).toBe("");
    expect(workspaceNote(null, { code: "x".repeat(7000) })).toContain("(cut short here)");
  });
});

describe("the tutor's replies on screen", () => {
  it("renders Markdown and mathematics", () => {
    const html = renderReply("So **twelve** take away three is $12 - 3 = 9$.");
    expect(html).toContain("<strong>twelve</strong>");
    expect(html).toContain('class="katex"');
  });
  it("shows HTML as text, drops images and only links to web addresses", () => {
    const html = renderReply('<img src=x onerror="alert(1)"> <script>alert(2)</script>\n\n![a cat](https://example.com/cat.png) [bad](javascript:alert(3)) [good](https://example.com/)');
    expect(html).not.toMatch(/<img|<script|javascript:/);
    expect(html).toContain("&lt;img");
    expect(html).toContain("a cat");
    expect(html).toContain('<a href="https://example.com/" target="_blank" rel="noopener noreferrer">good</a>');
  });
  it("does not fail on mathematics that is still arriving or malformed", () => {
    expect(() => renderReply("The slope is $\\frac{1}{")).not.toThrow();
    expect(() => renderReply("$$\\badcommand{x}$$")).not.toThrow();
  });
});

describe("the tutor's cost", () => {
  it("prices a reply from its token counts, with cached text far cheaper", () => {
    expect(costMicroUsd("claude-opus-5-5", { input_tokens: 2000, output_tokens: 600 })).toBe(20_000);
    expect(costMicroUsd("claude-opus-5-5", { cache_read_input_tokens: 10_000 })).toBe(2_000);
    expect(costMicroUsd("claude-opus-5-5", { cache_creation_input_tokens: 10_000 })).toBe(80_000);
    expect(costMicroUsd("claude-haiku-5-5", { input_tokens: 2000, output_tokens: 600 })).toBe(500);
    // An unknown model is charged at the dearest rate rather than at nothing.
    expect(costMicroUsd("some-new-model", { input_tokens: 1000 })).toBe(4_000);
  });
  it("has modest defaults that the environment can change", () => {
    expect(tutorModel()).toBe("claude-opus-5-5");
    expect(tutorEffort()).toBe("medium");
    process.env.AXIOM_TUTOR_EFFORT = "low";
    // Low effort is never used, even if asked for.
    expect(tutorEffort()).toBe("medium");
    process.env.AXIOM_TUTOR_EFFORT = "high";
    expect(tutorEffort()).toBe("high");
    delete process.env.AXIOM_TUTOR_EFFORT;
  });
});

describe("the tutor's conversation", () => {
  const url = process.env.TEST_DATABASE_URL ?? "postgres://axiom:axiom@localhost:5432/axiom_test";
  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool, { schema });
  let userId: string;

  beforeAll(async () => {
    await migrate(url, () => {});
  });
  beforeEach(async () => {
    await pool.query("truncate users, sessions, login_attempts, attempts, hint_views, lesson_progress, code_snapshots, tutor_messages restart identity cascade");
    const created = await signUp(db, "vitest");
    if (!created.ok) throw new Error("sign-up failed");
    userId = (await pool.query<{ id: string }>("select id from users")).rows[0].id;
  });
  afterAll(async () => {
    await pool.end();
  });

  it("keeps one thread per lesson, oldest first", async () => {
    await saveTutorMessage(db, userId, "m0.counting", "user", "Why pebbles?");
    await saveTutorMessage(db, userId, "m0.counting", "assistant", "One for each sheep.", 20_000);
    await saveTutorMessage(db, userId, "m0.adding", "user", "A different lesson");
    expect((await tutorHistory(db, userId, "m0.counting")).map((m) => [m.role, m.content])).toEqual([
      ["user", "Why pebbles?"],
      ["assistant", "One for each sheep."],
    ]);
    expect(await tutorHistory(db, userId, "m0.counting", 1)).toHaveLength(1);
  });

  it("reports attempts, wrong attempts and time spent on each question", async () => {
    const attempt = (questionId: string, correct: boolean, ms: number) =>
      recordAttempt(db, userId, { conceptId: "m0.counting", questionId, system: "s2", correct, answer: "x", ms }, ["pebbles", "other"]);
    await attempt("pebbles", false, 30_000);
    await attempt("pebbles", false, 45_000);
    await attempt("pebbles", true, 15_000);
    await attempt("other", false, 5_000);
    const effort = await questionEffort(db, userId, "m0.counting");
    expect(effort.get("pebbles")).toEqual({ tries: 3, wrong: 2, ms: 90_000 });
    expect(effort.get("other")).toEqual({ tries: 1, wrong: 1, ms: 5_000 });
    expect((await questionEffort(db, userId, "m0.adding")).size).toBe(0);
  });

  it("clears one lesson's conversation and leaves the others", async () => {
    await saveTutorMessage(db, userId, "m0.counting", "assistant", "a", 20_000);
    await saveTutorMessage(db, userId, "m0.adding", "assistant", "b", 1_500_000);
    await clearTutorHistory(db, userId, "m0.counting");
    expect(await tutorHistory(db, userId, "m0.counting")).toEqual([]);
    expect(await tutorHistory(db, userId, "m0.adding")).toHaveLength(1);
  });
});
