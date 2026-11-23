import "katex/dist/katex.min.css";
import type { Metadata } from "next";
import { Suspense } from "react";
import { LessonView } from "@/components/lesson/lesson-view";
import { Workspace } from "@/components/workspace/workspace";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { nextConcept } from "@/lib/learning/next";
import { completedConcepts, hintLevels, snapshotsFor, solvedQuestions } from "@/lib/learning/service";
import { content } from "@/lib/lessons/content";
import { questionsOf } from "@/lib/lessons/load";

export const metadata: Metadata = { title: "Learn" };

const TRACKS = { M: "Mathematics", L: "Machine learning", E: "Engineering" } as const;

const SCRATCH = `# Python runs here, in your browser. Press Run.
total = 0
for n in range(1, 11):
    total = total + n

print("1 + 2 + ... + 10 =", total)
`;

/**
 * Learn is the whole navigation: it works out the one lesson to do now.
 * That lesson always builds directly on the lesson just finished.
 */
async function Lesson() {
  const user = await requireUser();
  const db = getDb();
  const { graph, lessons } = content();
  const next = nextConcept(graph, new Set(lessons.keys()), await completedConcepts(db, user.id));

  if (!next) {
    const snapshots = await snapshotsFor(db, user.id, "axiom-code:scratch");
    return (
      <Workspace id="scratch" breadcrumb={["Scratch"]} starterCode={SCRATCH} snapshots={snapshots}>
        <article className="prose-lesson">
          <p className="label">{lessons.size > 0 ? "Up to date" : "Warm-up"}</p>
          <h1>{lessons.size > 0 ? "You have finished every lesson written so far." : "Your workspace is ready."}</h1>
          <p>
            {lessons.size > 0
              ? "The next batch is being written and checked. It will appear here, and it will build on the lesson you just finished."
              : "Lessons will appear on this side. The first batch is being written and checked now."}
          </p>
          <p>
            Until then the editor is yours. Press <code>Run</code>, or <code>Ctrl</code> + <code>Enter</code>. Your code is
            saved as you type.
          </p>
        </article>
      </Workspace>
    );
  }

  const lesson = lessons.get(next.id)!;
  const concept = graph.concepts.get(next.id)!;
  const [solved, hints, snapshots] = await Promise.all([
    solvedQuestions(db, user.id, concept.id),
    hintLevels(db, user.id, concept.id),
    snapshotsFor(db, user.id, `axiom-code:${concept.id}`),
  ]);
  const ids = questionsOf(lesson).map((q) => q.id);
  return (
    <Workspace
      key={concept.id}
      id={concept.id}
      breadcrumb={[TRACKS[concept.track], graph.clusters.get(concept.cluster)!.title, concept.title]}
      starterCode={lesson.starter ?? "# Scratch space. Try things here.\n"}
      snapshots={snapshots}
      lesson={{ total: ids.length, solved: ids.filter((id) => solved.has(id)), complete: false }}
    >
      <LessonView lesson={lesson} concept={concept} graph={graph} solved={solved} hintLevels={hints} />
    </Workspace>
  );
}

export default function Learn() {
  return (
    <Suspense
      fallback={
        <div className="ws">
          <header className="ws-top">
            <span className="font-mono text-[13px] tracking-[0.32em] text-ink">AXIOM</span>
            <span className="label" role="status">
              Finding your next lesson
            </span>
          </header>
        </div>
      }
    >
      <Lesson />
    </Suspense>
  );
}
