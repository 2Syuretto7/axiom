import { capstoneQuestions, type Capstone } from "../capstones/schema";
import type { Graph } from "../graph/load";
import { questionsOf } from "../lessons/load";
import { PARTS, type Lesson, type Question } from "../lessons/schema";

const TRACKS = { M: "Mathematics", L: "Machine learning", E: "Engineering" } as const;
const REF = /\[\[([a-z0-9.-]+)\]\]/g;

const TEACHING = `You are the tutor inside Axiom, one learner's personal university for the mathematics, science and engineering of machine learning. The curriculum starts from counting and builds upwards one lesson at a time, each lesson resting directly on the ones before it. You sit beside the lesson and the learner's Python editor, and the learner asks you things while working.

How you teach, in the manner of Richard Feynman:
- Start from first principles and from something the learner can picture or compute. Intuition comes first, and the formal statement comes after it.
- Derive, do not declare. When a result matters, show where it comes from in small steps that each follow from the last, rather than stating it and asking for trust.
- Use one concrete example with actual numbers before any general statement. Prefer a fresh example to repeating the lesson's own.
- Say things plainly. If a simpler word will do, use it. Name a piece of jargon only after the idea behind it is clear.
- Find the exact point where the learner's understanding stops. If the question shows a specific confusion, address that confusion, not the whole topic.
- Be honest about what is hard, and say so when something is a convention rather than a truth.

Staying close to what the learner knows:
- The learner has finished only the lessons listed under "Finished". Build every explanation from those ideas and from the lesson in progress. Do not lean on anything else, however standard it is.
- If a good answer needs an idea from a lesson that is still ahead, say that it comes later and name the lesson if it is listed. Then give the most honest explanation you can using only what the learner already has.
- When an earlier lesson is the real source of the difficulty, point back to it by its title.
- If the question is unrelated to the curriculum, answer briefly and steer back to the lesson.

Questions in the lesson:
- The lesson's questions are given to you with their answers so that you can check the learner's reasoning. For a question the learner has not solved yet, never state the answer, never write the solution code and never confirm a guess that came without reasoning. Ask for their reasoning, find the first step that goes wrong, and give the smallest nudge that lets them take the next step themselves.
- Match your help to how stuck the learner is, using the attempts, time and hints reported with each message. If they have barely tried, hold back: ask one clarifying question at most and let them work. If they are truly stuck (several wrong attempts, a long time on the question, or a plain request for help), give the smallest hint that unblocks the next step, and only go further up the question's hint ladder if that was not enough. Never reach the answer itself.
- Use the same report to judge whether a message is about a question at all. If it is about something else, explain fully.
- Once a question is solved you may discuss its answer freely, including other approaches and where the idea leads.
- When the learner shares code, read what it actually does, line by line. Point to the line that matters and explain why it behaves that way. Use only Python the learner has met in finished lessons or this one.

Form:
- Keep replies short: usually under 150 words, longer only when a derivation needs the room. One idea at a time. End with a small question or a next step when that helps the learner think, not as a habit.
- Write in Indian English spelling (for example "colour", "learnt", "maths"). Never use emojis.
- Use Markdown. Write mathematics in LaTeX between dollar signs: $x^2$ inline and $$...$$ on its own line for a displayed step. Put code in fenced blocks marked python. Do not use images or HTML.
- Refer to lessons by their titles, never by an id.`;

const title = (graph: Graph, id: string) => graph.concepts.get(id)?.title ?? id;
const plain = (graph: Graph, text: string) => text.replace(REF, (_, id: string) => title(graph, id));

function questionText(graph: Graph, q: Question, number: number): string {
  const lines = [`Question ${number} (id ${q.id}, ${q.type}):`, plain(graph, q.prompt)];
  if (q.type === "numeric") lines.push(`Answer: ${q.answer}${q.unit ? ` ${q.unit}` : ""}`);
  if (q.type === "choice") lines.push(`Options: ${q.options.map((o) => plain(graph, o)).join(" | ")}`, `Answer: ${plain(graph, q.options[q.answer])}`);
  if (q.type === "predict") lines.push("Code:", q.code, `It prints: ${q.output}`);
  if (q.type === "order") lines.push("Correct order:", ...q.steps.map((step, i) => `${i + 1}. ${plain(graph, step)}`));
  if (q.type === "code") lines.push(`Kind: ${q.mode === "find-bug" ? "find and fix the bug" : "write the program"}`, "Starting code:", q.starter, "Reference solution:", q.solution, "Checks:", q.tests);
  lines.push("Hints the learner can ask for, in order:", ...q.hints.map((hint, i) => `${i + 1}. ${plain(graph, hint)}`));
  lines.push(`Explanation shown once solved: ${plain(graph, q.explanation)}`);
  return lines.join("\n");
}

/** A lesson as plain text, with its questions and their answers. */
export function lessonText(graph: Graph, lesson: Lesson): string {
  const numbers = new Map(questionsOf(lesson).map((q, i) => [q.id, i + 1]));
  const out: string[] = [];
  for (const part of PARTS) {
    out.push(`## ${part}`);
    for (const block of lesson.parts[part]) {
      if ("text" in block) out.push(plain(graph, block.text));
      else if ("figure" in block) out.push(`(An interactive figure is shown here: ${block.figure.replace(/-/g, " ")}.)`);
      else out.push(questionText(graph, block.question, numbers.get(block.question.id)!));
    }
  }
  return out.join("\n\n");
}

function capstoneText(graph: Graph, capstone: Capstone): string {
  const numbers = new Map(capstoneQuestions(capstone).map((q, i) => [q.id, i + 1]));
  const out = ["## The project", plain(graph, capstone.brief)];
  capstone.stages.forEach((stage, s) => {
    out.push(`## Stage ${s + 1} of ${capstone.stages.length}: ${plain(graph, stage.title)}`);
    for (const block of stage.blocks) {
      if ("text" in block) out.push(plain(graph, block.text));
      else if ("figure" in block) out.push(`(An interactive figure is shown here: ${block.figure.replace(/-/g, " ")}.)`);
      else out.push(questionText(graph, block.question, numbers.get(block.question.id)!));
    }
  });
  out.push("## What you built (the learner sees this only once every stage is solved)", plain(graph, capstone.review));
  return out.join("\n\n");
}

/** Finished lessons grouped by cluster, in the order of the curriculum. */
function finishedText(graph: Graph, completed: string[]): string {
  const done = new Set(completed);
  const lines: string[] = [];
  for (const cluster of graph.clusters.values()) {
    const titles = cluster.concepts.filter((id) => done.has(id)).map((id) => title(graph, id));
    if (titles.length) lines.push(`- ${TRACKS[cluster.track]}, ${cluster.title}: ${titles.join("; ")}`);
  }
  return lines.length ? lines.join("\n") : "None yet. This is the learner's very first lesson, so assume nothing beyond everyday experience.";
}

export type TutorPosition = {
  graph: Graph;
  /** Completed concepts, oldest first. */
  completed: string[];
  /** The lesson in progress, or null when every written lesson is finished. */
  lesson: Lesson | null;
  /** The lesson Learn gives after this one. */
  next: string | null;
  /** The mini-capstone in progress, when Learn has given one instead of a lesson. */
  capstone?: Capstone | null;
};

/**
 * Everything the tutor is told before the conversation. It depends only on the lesson and on
 * which lessons are finished, so it is identical for every question asked during a lesson
 * and can be cached. Anything that changes from question to question goes in `workspaceNote`.
 */
export function systemPrompt({ graph, completed, lesson, next, capstone }: TutorPosition): string {
  const sections = [TEACHING, `# Finished\n${finishedText(graph, completed)}`];
  if (capstone) {
    const cluster = graph.clusters.get(capstone.cluster);
    sections.push(
      [
        "# In progress",
        `Mini-capstone: ${capstone.title}${cluster ? ` (${TRACKS[cluster.track]}, ${cluster.title})` : ""}`,
        `By the end the learner will have: ${capstone.claim}`,
        "A mini-capstone closes a cluster the learner has just finished. It teaches nothing new: it is one small project, built in stages, that needs several of the cluster's lessons at once. Putting those lessons together is the whole exercise, so the joining up is the learner's to do. Treat its questions exactly as you treat a lesson's questions. When the learner is stuck, name the finished lesson that holds the idea they need and let them carry it across themselves, rather than showing how the pieces fit.",
        next ? `Comes after it: ${title(graph, next)}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      `# The mini-capstone as the learner sees it\n${capstoneText(graph, capstone)}`,
    );
  } else if (lesson) {
    const concept = graph.concepts.get(lesson.concept);
    const cluster = concept && graph.clusters.get(concept.cluster);
    const recent = completed.at(-1);
    const later = lesson.leads.filter((id) => id !== next);
    sections.push(
      [
        "# In progress",
        `Lesson: ${title(graph, lesson.concept)}${cluster ? ` (${TRACKS[cluster.track]}, ${cluster.title})` : ""}`,
        `After it the learner can: ${lesson.claim}`,
        recent ? `Finished just before it: ${title(graph, recent)}` : null,
        lesson.recalls.length ? `It builds on: ${lesson.recalls.map((id) => title(graph, id)).join("; ")}` : null,
        next ? `Comes next: ${title(graph, next)}` : null,
        later.length ? `Comes later: ${later.map((id) => title(graph, id)).join("; ")}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      `# The lesson as the learner sees it\n${lessonText(graph, lesson)}`,
    );
  } else {
    sections.push(
      "# In progress\nThe learner has finished every lesson written so far and is using the scratch editor while the next batch is written. Help with revision of finished lessons and with whatever they try in the editor.",
    );
  }
  return sections.join("\n\n");
}

export type WorkspaceState = {
  questionId?: string | null;
  code?: string;
  output?: string;
  solved?: string[];
  /** Attempts, wrong attempts and time spent, by question id. */
  effort?: Map<string, { tries: number; wrong: number; ms: number }>;
  /** Hints revealed so far, by question id. */
  hints?: Map<string, number>;
};

const duration = (ms: number) => (ms < 60_000 ? `${Math.max(1, Math.round(ms / 1000))} s` : `${Math.round(ms / 60_000)} min`);

const cut = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}\n(cut short here)` : text);

/** What is on the learner's screen right now. Sent with the newest message only. */
export function workspaceNote(unit: Lesson | Capstone | null, state: WorkspaceState): string {
  const lines: string[] = [];
  if (unit) {
    const questions = "parts" in unit ? questionsOf(unit) : capstoneQuestions(unit);
    const solved = new Set(state.solved ?? []);
    const number = (id: string) => questions.findIndex((q) => q.id === id) + 1;
    const done = questions.filter((q) => solved.has(q.id)).map((q) => number(q.id));
    lines.push(done.length ? `Questions solved so far: ${done.join(", ")} of ${questions.length}.` : `No questions solved yet, of ${questions.length}.`);
    for (const q of questions) {
      const effort = state.effort?.get(q.id);
      const hints = state.hints?.get(q.id) ?? 0;
      if (!effort && !hints) continue;
      const parts = [solved.has(q.id) ? "solved" : "not solved"];
      if (effort) parts.push(`${effort.tries} ${effort.tries === 1 ? "attempt" : "attempts"}, ${effort.wrong} wrong`, `${duration(effort.ms)} spent`);
      if (hints) parts.push(`${hints} of ${q.hints.length} hints seen`);
      lines.push(`Question ${number(q.id)}: ${parts.join("; ")}.`);
    }
    const open = state.questionId ? number(state.questionId) : 0;
    if (open > 0) lines.push(`The editor holds the learner's attempt at question ${open}${solved.has(state.questionId!) ? " (solved)" : " (not solved yet)"}.`);
  }
  if (state.code?.trim()) lines.push("Code in the editor:", "```python", cut(state.code, 6000), "```");
  if (state.output?.trim()) lines.push("Output of the last run:", "```", cut(state.output, 2000), "```");
  return lines.length ? `<workspace>\n${lines.join("\n")}\n</workspace>` : "";
}
