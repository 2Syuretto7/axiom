import { describe, expect, it } from "vitest";
import { ancestors, loadGraph, topologicalOrder } from "@/lib/graph/load";

const graph = loadGraph();
const byTrack = (t: string) => [...graph.concepts.values()].filter((c) => c.track === t).length;

describe("knowledge graph", () => {
  it("has the planned size", () => {
    expect([byTrack("M"), byTrack("L"), byTrack("E")]).toEqual([238, 166, 173]);
    expect(graph.concepts.size).toBe(577);
    expect(graph.clusters.size).toBe(54);
  });

  it("has no prerequisite cycles", () => {
    expect(topologicalOrder(graph)).toHaveLength(577);
  });

  it("starts from exactly two roots: arithmetic and first programming", () => {
    const roots = [...graph.concepts.values()].filter((c) => c.requires.length === 0).map((c) => c.id);
    expect(roots.sort()).toEqual(["e0.what-a-program-is", "m0.whole-numbers-and-place-value"]);
  });

  it("makes every concept reachable from the roots", () => {
    for (const concept of graph.concepts.values()) {
      if (concept.requires.length === 0) continue;
      const up = ancestors(graph, concept.id);
      expect(up.has("m0.whole-numbers-and-place-value") || up.has("e0.what-a-program-is")).toBe(true);
    }
  });

  it("orders the tracks so that theory precedes its practice", () => {
    const backprop = ancestors(graph, "l5.backpropagation-on-an-arbitrary-graph");
    expect(backprop.has("m12.gradient")).toBe(true);
    expect(backprop.has("m13.reverse-mode-differentiation-and-its-cost")).toBe(true);
    expect(backprop.has("e6.training-an-mlp-on-your-own-engine")).toBe(true);
    expect(ancestors(graph, "l7.the-transformer-block").has("m20.cross-entropy")).toBe(true);
  });
});
