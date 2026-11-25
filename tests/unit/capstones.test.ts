import path from "node:path";
import { describe, expect, it } from "vitest";
import { capstoneCluster, capstoneId, capstoneQuestions, isCapstoneId } from "@/lib/capstones/schema";
import { validateCapstones } from "@/lib/capstones/validate";
import { loadGraph } from "@/lib/graph/load";
import { buildMap } from "@/lib/learning/map";
import { nextStep } from "@/lib/learning/next";
import { FIGURE_NAMES } from "@/lib/lessons/figures";
import { loadCapstones, loadLessons, loadPythonFeatures, readLessonFiles, type LessonFile } from "@/lib/lessons/load";
import { runPython } from "@/lib/lessons/node-python";
import { systemPrompt, workspaceNote } from "@/lib/tutor/prompt";

const root = path.join(import.meta.dirname, "..", "fixtures");
const graph = loadGraph(path.join(root, "graph"));
const features = loadPythonFeatures(path.join(root, "graph"));
const lessons = loadLessons(path.join(root, "content", "lessons"));
const written = new Set(lessons.keys());
const files = () => readLessonFiles(path.join(root, "content", "capstones"));

type Raw = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const check = (changed: LessonFile[] = files(), w = written) =>
  validateCapstones({ graph, files: changed, written: w, features, figures: new Set<string>(FIGURE_NAMES), run: runPython, minWords: 0 });

/** The fixture mini-capstone with an edit made to it. */
async function messages(edit: (capstone: Raw) => void) {
  const all = files();
  edit(all[0].raw as Raw);
  return (await check(all)).map((issue) => issue.message).join("\n");
}
const question = (capstone: Raw, id: string): Raw =>
  (capstone.stages as Raw[]).flatMap((stage) => stage.blocks as Raw[]).find((block) => block.question?.id === id)!.question;

describe("mini-capstone ids", () => {
  it("keeps a mini-capstone's progress apart from any concept", () => {
    expect(capstoneId("E0")).toBe("capstone.e0");
    expect(isCapstoneId("capstone.e0")).toBe(true);
    expect(isCapstoneId("e0.printing")).toBe(false);
    expect(capstoneCluster("capstone.m10")).toBe("M10");
    expect(graph.concepts.has(capstoneId("E0"))).toBe(false);
  });
});

describe("when Learn gives a mini-capstone", () => {
  const all = ["m0.counting", "m0.adding", "e0.printing"];
  const none = new Set<string>();
  const step = (capstones: string[], completed: string[], done: string[] = []) => nextStep(graph, written, new Set(capstones), completed, new Set(done));

  it("gives lessons alone when no mini-capstone is written", () => {
    expect(step([], [])).toEqual({ kind: "lesson", id: "m0.counting", builds: true });
    expect(step([], all)).toBeNull();
    expect(nextStep(graph, written, none, ["m0.counting"], none)).toEqual({ kind: "lesson", id: "m0.adding", builds: true });
  });

  it("gives a cluster's mini-capstone straight after the lesson that closes the cluster, before the next lesson", () => {
    expect(step(["M0"], ["m0.counting"])).toEqual({ kind: "lesson", id: "m0.adding", builds: true });
    expect(step(["M0"], ["m0.counting", "m0.adding"])).toEqual({ kind: "capstone", cluster: "M0" });
  });

  it("goes on to the lesson that builds on the last lesson once the mini-capstone is finished", () => {
    expect(step(["M0"], ["m0.counting", "m0.adding"], ["M0"])).toEqual({ kind: "lesson", id: "e0.printing", builds: true });
  });

  it("does not interrupt the lessons for a mini-capstone written after the learner moved on, and gives it when no lesson is open", () => {
    // Printing was finished last, so M0 is not the cluster just closed.
    const partway = nextStep(graph, new Set(["m0.counting", "m0.adding"]), new Set(["M0"]), ["m0.counting", "m0.adding"], new Set());
    expect(partway).toEqual({ kind: "capstone", cluster: "M0" });
    expect(step(["M0", "E0"], all, ["E0"])).toEqual({ kind: "capstone", cluster: "M0" });
    expect(step(["M0"], all)).toEqual({ kind: "capstone", cluster: "M0" });
  });

  it("gives waiting mini-capstones in the order their clusters were finished, and then nothing", () => {
    // E0's mini-capstone is the one just closed, so it comes first; M0's waits behind it.
    expect(step(["M0", "E0"], all)).toEqual({ kind: "capstone", cluster: "E0" });
    expect(step(["M0", "E0"], all, ["E0"])).toEqual({ kind: "capstone", cluster: "M0" });
    expect(step(["M0", "E0"], all, ["E0", "M0"])).toBeNull();
  });

  it("never gives the mini-capstone of a cluster that is not finished", () => {
    expect(step(["E0", "L1"], ["m0.counting", "m0.adding"])).toEqual({ kind: "lesson", id: "e0.printing", builds: true });
    expect(step(["L1"], all)).toBeNull();
  });
});

describe("mini-capstones on the map", () => {
  const titles = new Map([["E0", "A sum, shown"]]);
  const cluster = (map: ReturnType<typeof buildMap>, id: string) => map.clusters.find((c) => c.id === id)!;

  it("shows a mini-capstone as written, now and done, and agrees with Learn", () => {
    const before = buildMap(graph, written, ["m0.counting"], titles);
    expect(cluster(before, "E0").capstone).toEqual({ title: "A sum, shown", state: "written" });
    expect(cluster(before, "M0").capstone).toBeNull();
    expect(before.now).toBe("m0.adding");
    expect(before.capstoneNow).toBeNull();

    const due = buildMap(graph, written, ["m0.counting", "m0.adding", "e0.printing"], titles);
    expect(due.now).toBeNull();
    expect(due.capstoneNow).toBe("E0");
    expect(cluster(due, "E0").capstone?.state).toBe("now");
    expect(cluster(due, "E0").state).toBe("now");
    expect(due.counts).toMatchObject({ capstones: 1, capstonesDone: 0 });

    const done = buildMap(graph, written, ["m0.counting", "m0.adding", "e0.printing"], titles, new Set(["E0"]));
    expect(done.capstoneNow).toBeNull();
    expect(cluster(done, "E0").capstone?.state).toBe("done");
    expect(cluster(done, "E0").state).toBe("done");
    expect(done.counts).toMatchObject({ capstones: 1, capstonesDone: 1 });
  });

  it("leaves the order of lessons unchanged while a mini-capstone is due", () => {
    const due = buildMap(graph, new Set(["m0.counting", "m0.adding", "e0.printing"]), ["m0.counting", "m0.adding"], new Map([["M0", "Pebbles"]]));
    expect(due.capstoneNow).toBe("M0");
    expect(due.path.map((s) => `${s.id}:${s.state}`)).toEqual(["m0.counting:done", "m0.adding:done", "e0.printing:written"]);
  });
});

describe("mini-capstone validation", () => {
  it("accepts the fixture mini-capstone", async () => {
    expect(await check()).toEqual([]);
    const loaded = loadCapstones(path.join(root, "content", "capstones"));
    expect([...loaded.keys()]).toEqual(["E0"]);
    expect(capstoneQuestions(loaded.get("E0")!).map((q) => q.id)).toEqual(["by-hand", "read-it", "write-it"]);
  });

  it("holds its questions to the same checks as a lesson's", async () => {
    expect(await messages((c) => (question(c, "write-it").solution = "total = 12\nprint(total)\n"))).toContain("reference solution fails its own tests");
    expect(await messages((c) => (question(c, "write-it").tests = "assert total >= 0"))).toContain("starter already passes");
    expect(await messages((c) => (question(c, "read-it").output = "56"))).toContain('really prints: "11"');
    expect(await messages((c) => (question(c, "by-hand").answer = "eleven"))).toContain("is not a number");
    expect(await messages((c) => (question(c, "read-it").id = "by-hand"))).toContain("Duplicate question id");
  });

  it("only closes a cluster that exists, is fully written and has no other mini-capstone", async () => {
    expect(await messages((c) => (c.cluster = "E9"))).toContain("Unknown cluster E9");
    expect(await messages((c) => (c.cluster = "L1"))).toContain("L1 is not fully written yet. Missing lessons: l1.later");
    const twice = [...files(), { file: "again.yaml", raw: files()[0].raw }];
    expect((await check(twice)).map((issue) => issue.message).join("\n")).toContain("E0 already has a mini-capstone in e0.yaml");
  });

  it("teaches nothing new: no concept or Python beyond the cluster and its prerequisites", async () => {
    expect(await messages((c) => (c.brief = "This prepares for [[l1.later]]."))).toContain("[[l1.later]], which is not in E0 or among its prerequisites");
    expect(await messages((c) => (question(c, "by-hand").concepts = ["l1.later"]))).toContain("Exercises l1.later, which is not in E0 or among its prerequisites");
    expect(await messages((c) => (question(c, "read-it").code = "print(5 * 6)"))).toContain("Python the learner has not been taught yet: op:Mult");
    expect(await messages((c) => (question(c, "write-it").solution = "total = 5 + 6\nif total:\n    print(total)\n"))).toContain("node:If");
  });

  it("must bring the cluster together", async () => {
    expect(await messages((c) => delete question(c, "read-it").concepts)).toContain("Say which concepts this question exercises");
    expect(
      await messages((c) => {
        for (const id of ["read-it", "write-it"]) question(c, id).concepts = ["m0.adding"];
      }),
    ).toContain("Exercises 0 of the 1 lessons in E0");
    expect(await messages((c) => (c.stages[1].blocks = [{ text: "Nothing to do here." }]))).toContain("A stage needs at least one question");
    expect(await messages((c) => (question(c, "read-it").system = "s1"))).toContain("at least two slow (s2) questions");
    expect(await messages((c) => (c.stages[2].blocks = [{ question: { ...question(c, "read-it"), id: "again" } }]))).toContain("at least one stage must ask for code");
    expect(await messages((c) => c.stages.pop())).toContain("Too small");
  });

  it("asks for a question that needs two lessons of the cluster at once, where the cluster has two", async () => {
    const m0 = files();
    const raw = m0[0].raw as Raw;
    raw.cluster = "M0";
    raw.brief = "Count, then add.";
    raw.review = "You counted and added.";
    raw.stages = raw.stages.slice(0, 1).concat([
      { title: "Again", blocks: [{ question: { ...question(raw, "by-hand"), id: "again", system: "s2" } }] },
      { title: "Once more", blocks: [{ question: { ...question(raw, "by-hand"), id: "once-more", system: "s2" } }] },
    ]);
    expect((await check(m0)).map((issue) => issue.message)).toEqual(["No question needs two or more lessons of M0 at once"]);
    question(raw, "again").concepts = ["m0.counting", "m0.adding"];
    expect(await check(m0)).toEqual([]);
  });
});

describe("the tutor during a mini-capstone", () => {
  const capstone = loadCapstones(path.join(root, "content", "capstones")).get("E0")!;

  it("is told the project, its questions with their answers, and that joining the lessons is the learner's work", () => {
    const text = systemPrompt({ graph, completed: ["m0.counting", "m0.adding", "e0.printing"], lesson: null, capstone, next: null });
    expect(text).toContain("Mini-capstone: A sum, shown (Engineering, First programs)");
    expect(text).toContain("the joining up is the learner's to do");
    expect(text).toContain("Stage 3 of 3: Write it");
    expect(text).toContain("Question 3 (id write-it, code):");
    expect(text).toContain("as in Printing");
    expect(text).not.toContain("[[");
    expect(text).not.toContain("every lesson written so far");
  });

  it("reports which of its questions are solved", () => {
    const note = workspaceNote(capstone, { questionId: "write-it", code: "total = 0\n", solved: ["by-hand"] });
    expect(note).toContain("Questions solved so far: 1 of 3.");
    expect(note).toContain("attempt at question 3 (not solved yet)");
  });
});
