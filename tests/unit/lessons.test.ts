import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadGraph } from "@/lib/graph/load";
import { nextConcept, teachingPath } from "@/lib/learning/next";
import { checkProgram, explainFailure } from "@/lib/lessons/harness";
import { FIGURE_NAMES } from "@/lib/lessons/figures";
import { loadLessons, loadPythonFeatures, readLessonFiles, type LessonFile } from "@/lib/lessons/load";
import { runPython } from "@/lib/lessons/node-python";
import { renderBlock } from "@/lib/lessons/render";
import { validateLessons } from "@/lib/lessons/validate";

const root = path.join(import.meta.dirname, "..", "fixtures");
const graph = loadGraph(path.join(root, "graph"));
const features = loadPythonFeatures(path.join(root, "graph"));
const files = () => readLessonFiles(path.join(root, "content", "lessons"));

type Raw = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const check = (changed: LessonFile[] = files(), g = graph) =>
  validateLessons({ graph: g, files: changed, features, figures: new Set<string>(FIGURE_NAMES), run: runPython, minWords: 0 });

/** The fixture lessons with one of them edited. */
async function messages(concept: string, edit: (lesson: Raw) => void) {
  const all = files();
  edit(all.find((f) => (f.raw as Raw).concept === concept)!.raw as Raw);
  return (await check(all)).map((issue) => issue.message).join("\n");
}
const question = (lesson: Raw, id: string): Raw =>
  Object.values(lesson.parts as Record<string, Raw[]>)
    .flat()
    .find((block) => block.question?.id === id)!.question;

describe("lesson validation", () => {
  it("accepts the fixture curriculum", async () => {
    expect(await check()).toEqual([]);
    expect(loadLessons(path.join(root, "content", "lessons")).size).toBe(3);
  });

  it("rejects a reference solution that fails, tests a wrong answer passes, and a starter that already passes", async () => {
    expect(await messages("e0.printing", (l) => (question(l, "write-sum").solution = "total = 41\nprint(total)\n"))).toContain(
      "reference solution fails its own tests",
    );
    expect(await messages("e0.printing", (l) => (question(l, "write-hello").tests = "assert 'pebble' in output.lower()"))).toContain(
      "tests are too weak",
    );
    expect(await messages("e0.printing", (l) => (question(l, "fix-sum").starter = "print(9)\n"))).toContain("starter already passes");
  });

  it("rejects a predicted output that is not what the code prints", async () => {
    expect(await messages("e0.printing", (l) => (question(l, "predict-fast").output = "11"))).toContain('really prints: "2"');
  });

  it("rejects answers that are not numbers and hints that give the answer away", async () => {
    expect(await messages("m0.adding", (l) => (question(l, "sum-slow").answer = "twelve"))).toContain("is not a number");
    expect(await messages("m0.adding", (l) => question(l, "sum-slow").hints.push("It is 12."))).toContain("hint contains the answer");
  });

  describe("closeness: only what is learnt, being learnt, or next", () => {
    it("rejects Python the learner has not been taught", async () => {
      const text = await messages("e0.printing", (l) => (question(l, "predict-fast").code = "for i in range(2):\n    print(i)\n"));
      expect(text).toContain("has not been taught yet");
      expect(text).toContain("node:For");
    });
    it("rejects any Python at all before the learner has met Python", async () => {
      expect(await messages("m0.adding", (l) => l.parts.intuition.push({ text: "```python\nprint(3 + 4)\n```" }))).toContain("call:print");
    });
    it("rejects recalling or using a concept that is not a prerequisite", async () => {
      expect(await messages("m0.counting", (l) => l.uses.push("e0.printing"))).toContain("has not met it yet");
    });
    it("rejects mentioning a concept that is neither behind nor directly ahead", async () => {
      expect(await messages("m0.counting", (l) => l.parts.formal.push({ text: "See [[l1.later]]." }))).toContain("Mentions [[l1.later]]");
    });
    it("rejects a question that exercises a concept outside the lesson's reach", async () => {
      expect(await messages("m0.adding", (l) => (question(l, "sum-fast").concepts = ["e0.printing"]))).toContain("Exercises e0.printing");
    });
    it("rejects pointing forward to something that does not depend on this lesson", async () => {
      expect(await messages("m0.adding", (l) => l.leads.push("m0.counting"))).toContain("not what comes next");
    });
  });

  describe("continuity: each lesson builds on the one before", () => {
    it("requires a lesson to recall every direct prerequisite", async () => {
      expect(await messages("e0.printing", (l) => (l.recalls = []))).toContain("Must recall its direct prerequisite m0.adding");
    });
    it("rejects a half-written cluster", async () => {
      const partial = files().filter((f) => (f.raw as Raw).concept !== "m0.adding");
      expect((await check(partial)).map((i) => i.message).join("\n")).toContain("Half-written cluster");
    });
    it("rejects lessons that do not form one chain", async () => {
      // Make Printing depend on Counting only: after Adding, nothing builds on it.
      const forked = loadGraph(path.join(root, "graph"));
      forked.concepts.get("e0.printing")!.requires = ["m0.counting"];
      const all = files();
      (all.find((f) => (f.raw as Raw).concept === "e0.printing")!.raw as Raw).recalls = ["m0.counting"];
      (all.find((f) => (f.raw as Raw).concept === "e0.printing")!.raw as Raw).uses = [];
      const text = (await check(all, forked)).map((i) => i.message).join("\n");
      expect(text).toMatch(/no open lesson builds on it|can never be reached/);
    });
  });

  it("requires code reading and code writing once the learner knows Python", async () => {
    expect(
      await messages("e0.printing", (l) => {
        l.parts.work = l.parts.work.filter((b: Raw) => b.question.id !== "write-hello");
      }),
    ).toContain("at least two code-writing questions");
  });

  it("requires both fast and slow questions and a minimum depth", async () => {
    expect(await messages("m0.adding", (l) => (question(l, "sum-slow").system = "s1"))).toContain("No slow (s2) question");
    const short = await validateLessons({ graph, files: files(), features, figures: new Set<string>(FIGURE_NAMES), run: runPython, minWords: 500 });
    expect(short.some((i) => i.message.includes("the minimum is 500"))).toBe(true);
  });
});

describe("choosing the next lesson", () => {
  const written = new Set(["m0.counting", "m0.adding", "e0.printing"]);
  it("starts at the beginning and always moves to a lesson that builds on the last, across tracks", () => {
    expect(nextConcept(graph, written, [])).toEqual({ id: "m0.counting", builds: true });
    expect(nextConcept(graph, written, ["m0.counting"])).toEqual({ id: "m0.adding", builds: true });
    expect(nextConcept(graph, written, ["m0.counting", "m0.adding"])).toEqual({ id: "e0.printing", builds: true });
    expect(nextConcept(graph, written, ["m0.counting", "m0.adding", "e0.printing"])).toBeNull();
  });
  it("never offers a lesson whose prerequisites are unfinished, or one that is not written", () => {
    expect(nextConcept(graph, new Set(["e0.printing", "l1.later"]), [])).toBeNull();
    expect(teachingPath(graph, written)).toEqual({ path: ["m0.counting", "m0.adding", "e0.printing"], broken: null });
  });
});

describe("checking code", () => {
  it("lets tests read the learner's names and printed output", async () => {
    const ok = await runPython(checkProgram("x = 2\nprint(x * 3)\n", 'assert x == 2\nassert output == "6\\n"'));
    expect(ok.error).toBeNull();
  });
  it("lets tests rerun the learner's code with different starting values", async () => {
    const code = 'n = 7\nkind = "odd"\nif n % 2 == 0:\n    kind = "even"\nprint(kind)\n';
    const tests = 'assert kind == "odd"\nagain = rerun(n=10)\nassert again["kind"] == "even"\nassert again["output"] == "even\\n"\nassert rerun(n=-3)["kind"] == "odd"';
    expect((await runPython(checkProgram(code, tests))).error).toBeNull();
    const moved = await runPython(checkProgram('kind = "odd"\n', "rerun(n=10)"));
    expect(explainFailure(moved.error!).note).toBe("Keep the line that sets n at the top of your program");
  });
  it("turns a failed test into its message, and a crash into the learner's own traceback", async () => {
    const failed = await runPython(checkProgram("x = 1\n", 'assert x == 2, "x should be 2"'));
    expect(explainFailure(failed.error!)).toEqual({ note: "x should be 2", detail: null });
    const crashed = await runPython(checkProgram("y = 1\nprint(z)\n", "assert True"));
    const { note, detail } = explainFailure(crashed.error!);
    expect(note).toBe("Your code stopped with an error.");
    expect(detail).toContain("line 2");
    expect(detail).toContain("NameError");
    expect(detail).not.toContain("_pyodide");
  });
});

describe("rendering", () => {
  it("renders mathematics and names concepts by their titles", () => {
    const html = renderBlock("Now $a + b$ and [[m0.adding]].", (id) => graph.concepts.get(id)?.title);
    expect(html).toContain("katex");
    expect(html).toContain("Adding");
    expect(html).not.toContain("[[");
  });
});
