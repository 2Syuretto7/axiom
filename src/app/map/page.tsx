import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { TopBar } from "@/components/chrome";
import { MapView } from "@/components/map/map-view";
import { signOutAction } from "@/lib/auth/actions";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { buildMap } from "@/lib/learning/map";
import { completedConcepts } from "@/lib/learning/service";
import { content } from "@/lib/lessons/content";

export const metadata: Metadata = { title: "Map" };

const STEP = { done: "Done", now: "Now", written: "" } as const;

/**
 * The Map shows the whole curriculum and the order Learn follows through it.
 * It is for looking, not for choosing: Learn still decides the next lesson.
 */
async function Curriculum() {
  const user = await requireUser();
  const { graph, lessons } = content();
  const map = buildMap(graph, new Set(lessons.keys()), await completedConcepts(getDb(), user.id));
  const now = map.path.find((step) => step.state === "now");
  return (
    <>
      <p className="map-summary">
        {map.counts.done} of {map.counts.written} written lessons done. {map.counts.planned} more {map.counts.planned === 1 ? "is" : "are"} planned.{" "}
        {now ? `Learn will give you ${now.title} now.` : "You have finished every lesson written so far."}
      </p>
      <MapView map={map} />
      <section className="map-path" aria-labelledby="map-path-title">
        <h2 id="map-path-title">The order Learn follows</h2>
        <p>Each lesson builds directly on the one above it. This list and the Next line of every lesson come from the rule Learn uses.</p>
        <ol>
          {map.path.map((step) => (
            <li key={step.id} data-state={step.state} aria-current={step.state === "now" ? "step" : undefined}>
              <span className="label">{step.cluster}</span>
              <span>{step.title}</span>
              <span className="label">{STEP[step.state]}</span>
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
