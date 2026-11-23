/**
 * Checks every lesson before it can be merged. Run by `npm run lessons` and in CI.
 * Needs no network, database or secrets: Python runs under Node.
 */
import { loadGraph } from "../src/lib/graph/load";
import { FIGURE_NAMES } from "../src/lib/lessons/figures";
import {
  graphDir,
  lessonsDir,
  loadPythonFeatures,
  readLessonFiles,
} from "../src/lib/lessons/load";
import { runPython } from "../src/lib/lessons/node-python";
import { validateLessons } from "../src/lib/lessons/validate";

async function main() {
  const files = readLessonFiles(lessonsDir());
  const issues = await validateLessons({
    graph: loadGraph(graphDir()),
    files,
    features: loadPythonFeatures(),
    figures: new Set<string>(FIGURE_NAMES),
    run: runPython,
    minWords: 1200,
  });
  for (const issue of issues)
    console.error(`${issue.file} · ${issue.where}: ${issue.message}`);
  console.log(
    `${files.length} lesson${files.length === 1 ? "" : "s"} checked, ${issues.length} problem${issues.length === 1 ? "" : "s"}.`,
  );
  process.exit(issues.length ? 1 : 0);
}

void main();
