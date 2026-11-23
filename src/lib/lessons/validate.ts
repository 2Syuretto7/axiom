import { ancestors, type Graph } from "../graph/load";
import { teachingPath } from "../learning/next";
import { normaliseOutput } from "./grade";
import { checkProgram, featureProgram } from "./harness";
import type { LessonFile } from "./load";
import type { RunPython } from "./node-python";
import { parseRational } from "./number";
import { conceptRefs, renderBlock, renderInline } from "./render";
import { lesson as lessonSchema, PARTS, type Lesson, type Question } from "./schema";

export type Issue = { file: string; where: string; message: string };

export type ValidateOptions = {
  graph: Graph;
  files: LessonFile[];
  /** Which concept first teaches which Python feature. */
  features: Map<string, string[]>;
  figures: Set<string>;
  run: RunPython;
  /** Lessons are meant to be long and dense. The shortest prose a lesson may have. */
  minWords: number;
};

const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

/**
 * Everything a lesson must satisfy before the learner can see it.
 *
 * Correctness: answers parse, predicted outputs are real, reference solutions
 * pass their tests, and wrong solutions and starters fail them.
 *
 * Continuity: Learn can walk the written lessons as one chain in which each
 * lesson builds directly on the one before it, and each lesson recalls every
 * direct prerequisite.
 *
 * Closeness: a lesson may only lean on what the learner has learnt (its
 * prerequisites), what it is teaching now (its own concept) and what comes
 * next (concepts that depend on it). That holds for concepts named in the
 * text, for the concepts each question exercises, and for every Python
 * feature in any code the learner reads or is asked to write.
 */
export async function validateLessons(options: ValidateOptions): Promise<Issue[]> {
  const { graph, files, features, figures, run, minWords } = options;
  const issues: Issue[] = [];
  const lessons = new Map<string, { file: string; lesson: Lesson }>();

  for (const { file, raw } of files) {
    const parsed = lessonSchema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues.slice(0, 5)) {
        issues.push({ file, where: issue.path.join(".") || "lesson", message: issue.message });
      }
      continue;
    }
    const lesson = parsed.data;
    if (!graph.concepts.has(lesson.concept)) {
      issues.push({ file, where: "concept", message: `Unknown concept ${lesson.concept}` });
    } else if (lessons.has(lesson.concept)) {
      issues.push({ file, where: "concept", message: `${lesson.concept} already has a lesson in ${lessons.get(lesson.concept)!.file}` });
    } else {
      lessons.set(lesson.concept, { file, lesson });
    }
  }

  // Focused batches: a cluster is written whole or not at all.
  for (const cluster of graph.clusters.values()) {
    const written = cluster.concepts.filter((id) => lessons.has(id));
    if (written.length > 0 && written.length < cluster.concepts.length) {
      const missing = cluster.concepts.filter((id) => !lessons.has(id));
      issues.push({ file: `cluster ${cluster.id}`, where: "batch", message: `Half-written cluster. Missing lessons: ${missing.join(", ")}` });
    }
  }

  // One unbroken chain: every lesson builds directly on the one Learn offers before it.
  const { broken } = teachingPath(graph, new Set(lessons.keys()));
  if (broken) issues.push({ file: "graph", where: "chain", message: broken });

  const dependants = new Map<string, Set<string>>();
  for (const id of graph.concepts.keys()) {
    for (const ancestor of ancestors(graph, id)) {
      if (!dependants.has(ancestor)) dependants.set(ancestor, new Set());
      dependants.get(ancestor)!.add(id);
    }
  }

  for (const [concept, { file, lesson }] of lessons) {
    const add = (where: string, message: string) => issues.push({ file, where, message });
    const past = ancestors(graph, concept);
    const future = dependants.get(concept) ?? new Set<string>();

    for (const id of [...lesson.recalls, ...lesson.uses]) {
      if (!past.has(id)) add("recalls/uses", `${id} is not a prerequisite of ${concept}, so the learner has not met it yet`);
    }
    // Whichever lesson came just before this one, it is a direct prerequisite, so it is recalled here.
    for (const id of graph.concepts.get(concept)!.requires) {
      if (!lesson.recalls.includes(id)) add("recalls", `Must recall its direct prerequisite ${id}`);
    }
    for (const id of lesson.leads) {
      if (!future.has(id)) add("leads", `${id} does not depend on ${concept}, so it is not what comes next`);
    }
    if (future.size > 0 && lesson.leads.length === 0) add("leads", "Name at least one later concept this lesson prepares for");

    const near = new Set([concept, ...lesson.recalls, ...lesson.uses]);
    const mentionable = new Set([...near, ...lesson.leads]);
    const allowedPython = new Set([concept, ...past].flatMap((id) => features.get(id) ?? []));

    const checkCode = async (where: string, code: string) => {
      const result = await run(featureProgram(code));
      const listed = result.out.trim();
      if (result.error || listed === "syntax-error") return false;
      const beyond = (JSON.parse(listed) as string[]).filter((feature) => !allowedPython.has(feature));
      if (beyond.length > 0) add(where, `Uses Python the learner has not been taught yet: ${beyond.join(", ")}`);
      return true;
    };
    const checkText = async (where: string, text: string, inline = false) => {
      for (const id of conceptRefs(text)) {
        if (!mentionable.has(id)) add(where, `Mentions [[${id}]], which is not this concept, a listed prerequisite or a listed next concept`);
      }
      if (/in your own words/i.test(text)) add(where, "Explain-it-back prompts are not allowed");
      try {
        (inline ? renderInline : renderBlock)(text);
      } catch (error) {
        add(where, `Does not render: ${(error as Error).message}`);
      }
      for (const [, code] of text.matchAll(/```python\n([\s\S]*?)```/g)) {
        if (!(await checkCode(where, code))) add(where, "A Python example in the text does not parse");
      }
    };

    const seen = new Set<string>();
    const questions: Question[] = [];
    let prose = 0;
    if (lesson.starter) await checkCode("starter", lesson.starter);

    for (const part of PARTS) {
      for (const [index, block] of lesson.parts[part].entries()) {
        const where = `${part}[${index}]`;
        if ("text" in block) {
          prose += words(block.text);
          await checkText(where, block.text);
        } else if ("figure" in block) {
          if (!figures.has(block.figure)) add(where, `No figure named ${block.figure}`);
        } else {
          const q = block.question;
          const at = `${where} ${q.id}`;
          questions.push(q);
          if (seen.has(q.id)) add(at, "Duplicate question id");
          seen.add(q.id);
          if (part === "drill" && q.system !== "s1") add(at, "Drill questions are fast retrieval (s1)");
          for (const id of q.concepts ?? []) {
            if (!near.has(id)) add(at, `Exercises ${id}, which is not this concept or a listed prerequisite`);
          }
          await checkText(at, q.prompt);
          await checkText(at, q.explanation);
          for (const hint of q.hints) await checkText(at, hint);
          await checkQuestion(q, at, add, run, checkCode, checkText);
        }
      }
    }

    if (prose < minWords) add("lesson", `Only ${prose} words of teaching; the minimum is ${minWords}`);
    if (!questions.some((q) => q.system === "s1")) add("lesson", "No fast (s1) question");
    if (!questions.some((q) => q.system === "s2")) add("lesson", "No slow (s2) question");
    if (allowedPython.size > 0) {
      const reading = questions.filter((q) => q.type === "predict" || (q.type === "code" && q.mode === "find-bug")).length;
      const writing = questions.filter((q) => q.type === "code" && q.mode === "write").length;
      if (reading < 2) add("lesson", `Needs at least two code-reading questions; has ${reading}`);
      if (writing < 2) add("lesson", `Needs at least two code-writing questions; has ${writing}`);
    }
  }
  return issues;
}

async function checkQuestion(
  q: Question,
  at: string,
  add: (where: string, message: string) => void,
  run: RunPython,
  checkCode: (where: string, code: string) => Promise<boolean>,
  checkText: (where: string, text: string, inline?: boolean) => Promise<void>,
) {
  const passes = async (code: string) => (await run(checkProgram(code, (q as { tests: string }).tests))).error === null;
  switch (q.type) {
    case "numeric": {
      const answer = parseRational(q.answer);
      if (!answer) add(at, `Answer "${q.answer}" is not a number`);
      if (q.tolerance && !parseRational(q.tolerance)) add(at, `Tolerance "${q.tolerance}" is not a number`);
      const digits = q.answer.replace(/[^\d]/g, "");
      if (digits.length >= 2 && q.hints.some((hint) => new RegExp(`(^|[^\\d.])${q.answer.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}([^\\d]|$)`).test(hint))) {
        add(at, "A hint contains the answer");
      }
      break;
    }
    case "choice":
      if (q.answer >= q.options.length) add(at, "Answer index is beyond the options");
      if (new Set(q.options).size !== q.options.length) add(at, "Two options are identical");
      for (const option of q.options) await checkText(at, option, true);
      break;
    case "order":
      if (new Set(q.steps).size !== q.steps.length) add(at, "Two steps are identical");
      for (const step of q.steps) await checkText(at, step, true);
      break;
    case "predict": {
      if (!(await checkCode(at, q.code))) add(at, "The code does not parse");
      const result = await run(q.code);
      if (result.error) add(at, `The code fails when run: ${result.error.trim().split("\n").at(-1)}`);
      else if (normaliseOutput(result.out) !== normaliseOutput(q.output)) {
        add(at, `Stated output is wrong. The code really prints: ${JSON.stringify(normaliseOutput(result.out))}`);
      }
      if (q.hints.some((hint) => normaliseOutput(hint).includes(normaliseOutput(q.output)) && normaliseOutput(q.output).length >= 3)) {
        add(at, "A hint contains the output");
      }
      break;
    }
    case "code": {
      if (!(await checkCode(at, q.solution))) add(at, "The reference solution does not parse");
      const starterParses = await checkCode(at, q.starter);
      if (q.mode === "write" && !starterParses) add(at, "The starter does not parse");
      if (!(await passes(q.solution))) add(at, "The reference solution fails its own tests");
      if (await passes(q.starter)) add(at, "The starter already passes the tests");
      for (const [index, wrong] of q.wrong.entries()) {
        if (await passes(wrong)) add(at, `Wrong solution ${index + 1} passes the tests, so the tests are too weak`);
      }
      break;
    }
  }
}
