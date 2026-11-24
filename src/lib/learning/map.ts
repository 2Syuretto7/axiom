import type { Graph, Track } from "../graph/load";
import { nextConcept } from "./next";

export type LessonState = "done" | "now" | "written" | "planned";
export type MapLesson = { id: string; title: string; state: LessonState };
export type MapCluster = {
  id: string;
  title: string;
  track: Track;
  state: LessonState;
  /** Position on the map: row is how deep the cluster sits, x is its centre in columns. */
  row: number;
  x: number;
  requires: string[];
  opens: string[];
  lessons: MapLesson[];
};
export type MapStep = { id: string; title: string; cluster: string; state: "done" | "now" | "written" };
export type MapData = {
  clusters: MapCluster[];
  rows: number;
  columns: number;
  /** The lesson Learn gives now, if any. */
  now: string | null;
  /** Finished lessons in the order they were finished, then the written lessons in the order Learn will give them. */
  path: MapStep[];
  counts: { done: number; written: number; planned: number };
};

/**
 * Everything the Map shows. The order of lessons comes from `nextConcept`, the
 * rule Learn itself uses, so the Map cannot disagree with Learn.
 */
export function buildMap(graph: Graph, written: Set<string>, completed: string[]): MapData {
  const finished = completed.filter((id) => graph.concepts.has(id));
  const done = new Set(finished);
  const now = nextConcept(graph, written, finished)?.id ?? null;

  const walked = [...finished];
  for (let next = now; next; next = nextConcept(graph, written, walked)?.id ?? null) walked.push(next);
  const path: MapStep[] = walked.map((id) => {
    const concept = graph.concepts.get(id)!;
    return { id, title: concept.title, cluster: concept.cluster, state: done.has(id) ? "done" : id === now ? "now" : "written" };
  });

  const lessonState = (id: string): LessonState => (done.has(id) ? "done" : id === now ? "now" : written.has(id) ? "written" : "planned");

  // A cluster sits one row below the deepest cluster it needs.
  const rowOf = new Map<string, number>();
  const depth = (id: string): number => {
    if (!rowOf.has(id)) {
      const needs = graph.clusters.get(id)!.requires;
      rowOf.set(id, needs.length === 0 ? 0 : 1 + Math.max(...needs.map(depth)));
    }
    return rowOf.get(id)!;
  };
  const byRow: string[][] = [];
  for (const id of graph.clusters.keys()) (byRow[depth(id)] ??= []).push(id);
  const columns = Math.max(...byRow.map((row) => row.length));

  // Within a row, a cluster stands under the average position of what it needs, which keeps the lines short.
  const xOf = new Map<string, number>();
  for (const row of byRow) {
    const pull = (id: string) => {
      const needs = graph.clusters.get(id)!.requires;
      return needs.length === 0 ? columns / 2 : needs.reduce((sum, need) => sum + xOf.get(need)!, 0) / needs.length;
    };
    const pulls = new Map(row.map((id) => [id, pull(id)]));
    const sorted = [...row].sort((a, b) => pulls.get(a)! - pulls.get(b)! || row.indexOf(a) - row.indexOf(b));
    sorted.forEach((id, i) => xOf.set(id, (columns - sorted.length) / 2 + i + 0.5));
  }

  const opens = new Map<string, string[]>();
  for (const cluster of graph.clusters.values()) {
    for (const need of cluster.requires) opens.set(need, [...(opens.get(need) ?? []), cluster.id]);
  }

  const clusters: MapCluster[] = [...graph.clusters.values()].map((cluster) => {
    const lessons = cluster.concepts.map((id) => ({ id, title: graph.concepts.get(id)!.title, state: lessonState(id) }));
    const state: LessonState = lessons.every((l) => l.state === "done")
      ? "done"
      : lessons.some((l) => l.state === "now")
        ? "now"
        : lessons.some((l) => l.state !== "planned")
          ? "written"
          : "planned";
    return {
      id: cluster.id,
      title: cluster.title,
      track: cluster.track,
      state,
      row: rowOf.get(cluster.id)!,
      x: xOf.get(cluster.id)!,
      requires: cluster.requires,
      opens: opens.get(cluster.id) ?? [],
      lessons,
    };
  });

  const writtenCount = [...written].filter((id) => graph.concepts.has(id)).length;
  return {
    clusters,
    rows: byRow.length,
    columns,
    now,
    path,
    counts: { done: done.size, written: writtenCount, planned: graph.concepts.size - writtenCount },
  };
}
