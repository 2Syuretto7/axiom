import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { TopBar } from "@/components/chrome";
import { MapView } from "@/components/map/map-view";
import { signOutAction } from "@/lib/auth/actions";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { buildMap } from "@/lib/learning/map";
import { completedCapstones, completedConcepts } from "@/lib/learning/service";
import { masteryByLesson } from "@/lib/learning/standing";
import { content } from "@/lib/lessons/content";

export const metadata: Metadata = { title: "Map" };

const STEP = { done: "Done", now: "Now", written: "" } as const;

/**
 * The Map shows the whole curriculum and the order Learn follows through it.
 * It is for looking, not for choosing: Learn still decides the next lesson.
 */
async function Curriculum() {
  const user = await requireUser();
  const { graph, lessons, capstones } = content();
  const db = getDb();
  const [completed, capstonesDone, mastery] = await Promise.all([completedConcepts(db, user.id), completedCapstones(db, user.id), masteryByLesson(db, user.id)]);
  const percent = (id: string) => (mastery.has(id) ? ` · Mastery ${Math.round(mastery.get(id)! * 100)}%` : "");
  const titles = new Map([...capstones].map(([cluster, capstone]) => [cluster, capstone.title]));
  const map = buildMap(graph, new Set(lessons.keys()), completed, titles, capstonesDone);
  const now = map.path.find((step) => step.state === "now");
  const giving = map.capstoneNow
    ? `Learn will give you the ${map.capstoneNow} mini-capstone, ${titles.get(map.capstoneNow)}, now.`
    : now
      ? `Learn will give you ${now.title} now.`
      : "You have finished every lesson written so far.";
  return (
    <>
      <p className="map-summary">
        {map.counts.done} of {map.counts.written} written lessons done. {map.counts.planned} more {map.counts.planned === 1 ? "is" : "are"} planned.{" "}
        {map.counts.capstones > 0 ? `${map.counts.capstonesDone} of ${map.counts.capstones} mini-capstones done. ` : ""}
        {giving}
      </p>
      <MapView map={map} />
      <section className="map-path" aria-labelledby="map-path-title">
        <h2 id="map-path-title">The order Learn follows</h2>
        <p>
          Each lesson builds directly on the one above it. This list and the Next line of every lesson come from the rule Learn uses. Mastery of a finished lesson counts wrong tries,
          hints from the tutor and speed on timed questions. It weighs recent answers more, and it fades until the idea is recalled.
        </p>
        <ol>
          {map.path.map((step) => (
            <li key={step.id} data-state={step.state} aria-current={step.state === "now" ? "step" : undefined}>
              <span className="label">{step.cluster}</span>
              <span>{step.title}</span>
              <span className="label">
                {STEP[step.state]}
                {step.state === "done" ? percent(step.id) : ""}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

export default function MapPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar map>
        <form action={signOutAction}>
          <button type="submit" className="label bar-item">
            Sign out
          </button>
        </form>
      </TopBar>
      <main className="map-page">
        <p className="label">Map</p>
        <h1>Where you are, and what it leads to</h1>
        <Suspense
          fallback={
            <p className="label" role="status">
              Drawing the map
            </p>
          }
        >
          <Curriculum />
        </Suspense>
        <p className="map-learn">
          <Link href="/learn" className="btn btn-primary" prefetch={false}>
            Learn
            <span className="chevron" aria-hidden="true">
              ›
            </span>
          </Link>
        </p>
      </main>
    </div>
  );
}
