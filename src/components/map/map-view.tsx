"use client";

import { useState } from "react";
import type { LessonState, MapCluster, MapData } from "@/lib/learning/map";

const ROW = 56;
const TRACKS = { M: "Mathematics", L: "Machine learning", E: "Engineering" } as const;
const STATE: Record<LessonState, string> = { done: "Done", now: "Now", written: "Written", planned: "Planned" };
const CLUSTER_STATE: Record<LessonState, string> = {
  done: "finished",
  now: "you are here",
  written: "written, not started",
  planned: "planned, not written yet",
};

/** The curriculum as a drawing: every cluster, what it needs, and where the learner is. */
export function MapView({ map }: { map: MapData }) {
  const byId = new Map(map.clusters.map((c) => [c.id, c]));
  const here = map.clusters.find((c) => c.state === "now") ?? map.clusters.findLast((c) => c.state === "done") ?? map.clusters[0];
  const [selectedId, setSelectedId] = useState(here.id);
  const selected = byId.get(selectedId)!;
  const linked = new Set([...selected.requires, ...selected.opens]);

  const edges = map.clusters.flatMap((to) => to.requires.map((need) => ({ from: byId.get(need)!, to })));
  const touches = (edge: { from: MapCluster; to: MapCluster }) => edge.from.id === selectedId || edge.to.id === selectedId;
  const line = (edge: { from: MapCluster; to: MapCluster }, on: boolean) => (
    <line
      key={`${edge.from.id}-${edge.to.id}`}
      className={on ? "map-edge map-edge-on" : "map-edge"}
      x1={edge.from.x}
      y1={edge.from.row + 0.5}
      x2={edge.to.x}
      y2={edge.to.row + 0.5}
    />
  );
  const names = (ids: string[]) => ids.map((id) => `${id} ${byId.get(id)!.title}`).join(" · ");

  return (
    <div className="map">
      <div className="map-chart">
        <ul className="map-legend label" aria-label="Key">
          {(["done", "now", "written", "planned"] as const).map((state) => (
            <li key={state}>
              <span className="map-swatch" data-state={state} aria-hidden="true" />
              {STATE[state]}
            </li>
          ))}
        </ul>
        <div className="map-grid" style={{ height: map.rows * ROW }} role="group" aria-label="Clusters, foundations at the top">
          <svg viewBox={`0 0 ${map.columns} ${map.rows}`} preserveAspectRatio="none" aria-hidden="true">
            {edges.filter((e) => !touches(e)).map((e) => line(e, false))}
            {edges.filter(touches).map((e) => line(e, true))}
          </svg>
          {map.clusters.map((cluster) => (
            <button
              key={cluster.id}
              type="button"
              className="map-node"
              data-state={cluster.state}
              data-linked={linked.has(cluster.id) || undefined}
              aria-pressed={cluster.id === selectedId}
              aria-label={`${cluster.id} ${cluster.title}, ${CLUSTER_STATE[cluster.state]}`}
              style={{ left: `${(cluster.x / map.columns) * 100}%`, top: cluster.row * ROW + ROW / 2 }}
              onClick={() => setSelectedId(cluster.id)}
            >
              {cluster.id}
            </button>
          ))}
        </div>
      </div>

      <section className="map-panel" aria-label="Selected cluster" aria-live="polite">
        <p className="label">
          {selected.id} · {TRACKS[selected.track]} · {CLUSTER_STATE[selected.state]}
        </p>
        <h2>{selected.title}</h2>
        <p className="map-links">
          <span className="label">Needs</span> {selected.requires.length ? names(selected.requires) : "Nothing. This is where everything starts."}
        </p>
        <p className="map-links">
          <span className="label">Opens</span> {selected.opens.length ? names(selected.opens) : "Nothing further. This is an end of the map."}
        </p>
        <ol className="map-lessons">
          {selected.lessons.map((lesson) => (
            <li key={lesson.id} data-state={lesson.state}>
              <span>{lesson.title}</span>
              <span className="label">{STATE[lesson.state]}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
