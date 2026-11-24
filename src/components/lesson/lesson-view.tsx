import type { Concept, Graph } from "@/lib/graph/load";
import { blockHtml, questionView } from "@/lib/lessons/content";
import { questionsOf } from "@/lib/lessons/load";
import { PARTS, type Lesson } from "@/lib/lessons/schema";
import { Figure } from "./figures";
import { LessonEnd, QuestionCard } from "./question-card";

const PART_LABELS: Record<(typeof PARTS)[number], string> = {
  recall: "Recall",
  puzzle: "A puzzle",
  intuition: "Intuition",
  derivation: "Derivation",
  formal: "Formally",
  drill: "Drill",
  work: "Work",
  connections: "Connections",
};

const names = (graph: Graph, ids: string[]) => ids.map((id) => graph.concepts.get(id)?.title ?? id).join(" · ");

export function LessonView({
  lesson,
  concept,
  graph,
  next,
  solved,
  hintLevels,
}: {
  lesson: Lesson;
  concept: Concept;
  graph: Graph;
  /** The lesson Learn gives after this one, worked out by the same rule Learn uses. */
  next: string | null;
  solved: Set<string>;
  hintLevels: Map<string, number>;
}) {
  const later = lesson.leads.filter((id) => id !== next);
  const numbers = new Map(questionsOf(lesson).map((q, i) => [q.id, i + 1]));
  return (
    <article className="prose-lesson">
      <p className="label">
        {concept.cluster} · {graph.clusters.get(concept.cluster)!.title} · {lesson.minutes} min
      </p>
      <h1>{concept.title}</h1>
      <p className="lesson-claim">{lesson.claim}</p>
      {lesson.recalls.length > 0 ? (
        <p className="lesson-links">
          <span className="label">Builds on</span> {names(graph, lesson.recalls)}
        </p>
      ) : null}

      {PARTS.map((part) => (
        <section key={part} className="lesson-part" aria-label={PART_LABELS[part]}>
          <h2 className="label lesson-part-label">{PART_LABELS[part]}</h2>
          {lesson.parts[part].map((block, i) => {
            if ("text" in block) {
              // Lesson text is written and reviewed in this repository.
              return <div key={i} className="lesson-text" dangerouslySetInnerHTML={{ __html: blockHtml(block.text) }} />;
            }
            if ("figure" in block) {
              return <Figure key={i} name={block.figure} props={block.props} />;
            }
            const q = block.question;
            return <QuestionCard key={q.id} view={questionView(lesson.concept, q, numbers.get(q.id)!, solved.has(q.id), hintLevels.get(q.id) ?? 0)} />;
          })}
        </section>
      ))}

      {next ? (
        <p className="lesson-links lesson-next">
          <span className="label">Next</span> {names(graph, [next])}
        </p>
      ) : null}
      {later.length > 0 ? (
        <p className="lesson-links">
          <span className="label">Later</span> {names(graph, later)}
        </p>
      ) : null}
      <LessonEnd />
    </article>
  );
}
