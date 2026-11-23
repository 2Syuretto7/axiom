import { topologicalOrder, type Graph } from "../graph/load";

/**
 * Chooses the lesson Learn offers next.
 *
 * A lesson is open when it is written, not yet completed, and every one of its
 * prerequisites is completed. Among open lessons, the next one must build
 * directly on the lesson just finished: it lists that lesson's concept as a
 * prerequisite. It may be in the same track or a different one.
 *
 * `completed` is in the order the learner finished the lessons, oldest first.
 * `builds` is false only if no open lesson builds on the last one, which the
 * lesson checks in CI do not allow to be merged.
 */
export function nextConcept(graph: Graph, written: Set<string>, completed: string[]): { id: string; builds: boolean } | null {
  const done = new Set(completed);
  const open = topologicalOrder(graph).filter(
    (id) => written.has(id) && !done.has(id) && graph.concepts.get(id)!.requires.every((required) => done.has(required)),
  );
  if (open.length === 0) return null;
  const previous = completed.at(-1);
  if (previous === undefined) return { id: open[0], builds: true };
  const building = open.find((id) => graph.concepts.get(id)!.requires.includes(previous));
  return building ? { id: building, builds: true } : { id: open[0], builds: false };
}

/**
 * Walks the written lessons exactly as Learn will, from the very first one.
 * Returns the order, and a description of the first place the chain breaks.
 */
export function teachingPath(graph: Graph, written: Set<string>): { path: string[]; broken: string | null } {
  const path: string[] = [];
  for (;;) {
    const next = nextConcept(graph, written, path);
    if (!next) break;
    if (!next.builds) {
      return { path, broken: `After ${path.at(-1)} no open lesson builds on it. The next would be ${next.id}, which does not list it as a prerequisite` };
    }
    path.push(next.id);
  }
  const stranded = [...written].filter((id) => graph.concepts.has(id) && !path.includes(id));
  return { path, broken: stranded.length ? `These lessons can never be reached: ${stranded.join(", ")}` : null };
}
