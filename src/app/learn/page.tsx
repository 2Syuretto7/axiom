import "katex/dist/katex.min.css";
import type { Metadata } from "next";
import { after } from "next/server";
import { Suspense } from "react";
import { TopBar } from "@/components/chrome";
import { ReviewCard, type ReviewView } from "@/components/review/review-card";
import { signOutAction } from "@/lib/auth/actions";
import { prepareQuestion } from "@/lib/review/prepare";
import { optionOrder } from "@/lib/review/question";
import { pickReview, reviewQueue } from "@/lib/review/schedule";
import { dueBy, rememberFinishedLessons, reviewsSinceLastUnit, unitStarted } from "@/lib/review/service";
import { renderReply, renderReplyInline } from "@/lib/tutor/render";
import { CapstoneView } from "@/components/lesson/capstone-view";
import { LessonView } from "@/components/lesson/lesson-view";
import { Workspace } from "@/components/workspace/workspace";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { capstoneId, capstoneQuestions } from "@/lib/capstones/schema";
import { nextAfter, nextStep } from "@/lib/learning/next";
import { completedCapstones, completedConcepts, hintLevels, snapshotsFor, solvedQuestions } from "@/lib/learning/service";
import { content } from "@/lib/lessons/content";
import { questionsOf } from "@/lib/lessons/load";
import { tutorConnected } from "@/lib/tutor/config";
import { tutorHistory } from "@/lib/tutor/service";
import type { Db } from "@/lib/db";

/** The tutor's conversation on this lesson so far, and how much of the month's budget is left. */
async function tutorSetup(db: Db, userId: string, conceptId: string) {
  return { messages: await tutorHistory(db, userId, conceptId), connected: tutorConnected() };
}

export const metadata: Metadata = { title: "Learn" };
// Writing and checking a fresh review question can take the model a while.
export const maxDuration = 120;

const DAY = 86_400_000;
/** Questions are written ahead for lessons that fall due within this many days, so a review rarely has to wait for one. */
const WRITE_AHEAD_DAYS = 2;

const TRACKS = { M: "Mathematics", L: "Machine learning", E: "Engineering" } as const;

const SCRATCH = `# Python runs here, in your browser. Press Run.
total = 0
for n in range(1, 11):
    total = total + n

print("1 + 2 + ... + 10 =", total)
`;

/**
 * Learn is the whole navigation: it works out the one thing to do now.
 * That is a review of a finished lesson that is due, a lesson that builds
 * directly on the lesson just finished, or the mini-capstone that closes the
 * cluster just finished.
 */
async function Lesson() {
  const user = await requireUser();
  const db = getDb();
  const { graph, lessons, capstones } = content();
  const written = new Set(lessons.keys());
  const [completed, capstonesDone] = await Promise.all([completedConcepts(db, user.id), completedCapstones(db, user.id)]);
  const next = nextStep(graph, written, new Set(capstones.keys()), completed, capstonesDone);

  // A finished lesson comes back when it is due, with a question written for this one review.
  if (tutorConnected()) {
    await rememberFinishedLessons(db, user.id);
    const now = new Date();
    const unitId = next ? (next.kind === "capstone" ? capstoneId(next.cluster) : next.id) : null;
    const [soon, started, since] = await Promise.all([
      dueBy(db, user.id, new Date(now.getTime() + WRITE_AHEAD_DAYS * DAY)),
      unitId ? unitStarted(db, user.id, unitId) : false,
      reviewsSinceLastUnit(db, user.id),
    ]);
    const memories = soon.filter((memory) => lessons.has(memory.conceptId));
    const reviewing = pickReview(memories, now, { unitWaiting: next !== null, unitStarted: started, reviewsSinceUnit: since });
    const ahead = [...reviewQueue(memories, now), ...memories.map((memory) => memory.conceptId)].filter((id, i, all) => id !== reviewing && all.indexOf(id) === i);
    after(async () => {
      for (const id of ahead.slice(0, 2)) await prepareQuestion(db, user.id, id);
    });
    const stored = reviewing ? await prepareQuestion(db, user.id, reviewing) : null;
    if (stored) {
      const concept = graph.concepts.get(stored.conceptId)!;
      const memory = memories.find((m) => m.conceptId === stored.conceptId)!;
      const q = stored.question;
      const view: ReviewView = {
        id: stored.id,
        type: q.type,
        promptHtml: renderReply(q.prompt),
        unit: q.type === "numeric" ? q.unit : undefined,
        items: q.type === "choice" ? optionOrder(q, `review:${stored.id}`).map((i) => renderReplyInline(q.options[i])) : undefined,
        code: q.type === "predict" ? q.code : undefined,
      };
      const days = Math.max(1, Math.round((now.getTime() - memory.lastReviewedAt.getTime()) / DAY));
      return (
        <div className="flex min-h-dvh flex-col">
          <TopBar map>
            <form action={signOutAction}>
              <button type="submit" className="label bar-item">
                Sign out
              </button>
            </form>
          </TopBar>
          <main className="review-page">
            <article className="prose-lesson">
              <p className="label">
                Review · {concept.cluster} · {graph.clusters.get(concept.cluster)!.title}
              </p>
              <h1>{concept.title}</h1>
              <p className="lesson-claim">
                You last worked on this lesson {days} {days === 1 ? "day" : "days"} ago. Here is a question you have not seen before. You get one try, and
                there are no hints.
              </p>
              <ReviewCard key={stored.id} view={view} />
            </article>
          </main>
        </div>
      );
    }
  }

  if (!next) {
    const [snapshots, tutor] = await Promise.all([snapshotsFor(db, user.id, "axiom-code:scratch"), tutorSetup(db, user.id, "scratch")]);
    return (
      <Workspace id="scratch" breadcrumb={["Scratch"]} starterCode={SCRATCH} snapshots={snapshots} tutor={tutor}>
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

  if (next.kind === "capstone") {
    const capstone = capstones.get(next.cluster)!;
    const cluster = graph.clusters.get(next.cluster)!;
    const id = capstoneId(cluster.id);
    const [solved, hints, snapshots, tutor] = await Promise.all([
      solvedQuestions(db, user.id, id),
      hintLevels(db, user.id, id),
      snapshotsFor(db, user.id, `axiom-code:${id}`),
      tutorSetup(db, user.id, id),
    ]);
    const ids = capstoneQuestions(capstone).map((q) => q.id);
    return (
      <Workspace
        key={id}
        id={id}
        breadcrumb={[TRACKS[cluster.track], cluster.title, "Mini-capstone"]}
        starterCode={capstone.starter ?? "# Scratch space. Try things here.\n"}
        snapshots={snapshots}
        lesson={{ total: ids.length, solved: ids.filter((q) => solved.has(q)), complete: false }}
        tutor={tutor}
      >
        <CapstoneView capstone={capstone} cluster={cluster} graph={graph} solved={solved} hintLevels={hints} />
      </Workspace>
    );
  }

  const lesson = lessons.get(next.id)!;
  const concept = graph.concepts.get(next.id)!;
  const [solved, hints, snapshots, tutor] = await Promise.all([
    solvedQuestions(db, user.id, concept.id),
    hintLevels(db, user.id, concept.id),
    snapshotsFor(db, user.id, `axiom-code:${concept.id}`),
    tutorSetup(db, user.id, concept.id),
  ]);
  const ids = questionsOf(lesson).map((q) => q.id);
  // Finishing this lesson finishes its cluster, so the cluster's mini-capstone comes before the next lesson.
  // The lesson finished just before this one. If it is a prerequisite from another track, this lesson has a bridge for it.
  const previous = graph.concepts.get(completed.at(-1) ?? "");
  const bridgeText = previous ? lesson.bridges?.[previous.id] : undefined;
  const closesCluster = graph.clusters.get(concept.cluster)!.concepts.every((id) => id === concept.id || completed.includes(id));
  return (
    <Workspace
      key={concept.id}
      id={concept.id}
      breadcrumb={[TRACKS[concept.track], graph.clusters.get(concept.cluster)!.title, concept.title]}
      starterCode={lesson.starter ?? "# Scratch space. Try things here.\n"}
      snapshots={snapshots}
      lesson={{ total: ids.length, solved: ids.filter((id) => solved.has(id)), complete: false }}
      tutor={tutor}
    >
      <LessonView
        lesson={lesson}
        concept={concept}
        graph={graph}
        next={nextAfter(graph, written, completed, concept.id)}
        bridge={previous && bridgeText ? { from: previous, text: bridgeText } : null}
        capstone={closesCluster && !capstonesDone.has(concept.cluster) ? capstones.get(concept.cluster)?.title : null}
        solved={solved}
        hintLevels={hints}
      />
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
