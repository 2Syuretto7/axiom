import { loadPyodide, type PyodideInterface } from "pyodide";

export type PyRun = { out: string; error: string | null };
export type RunPython = (code: string) => Promise<PyRun>;

let ready: Promise<PyodideInterface> | undefined;

/** Runs Python under Node with the same interpreter the learner's browser uses. */
export const runPython: RunPython = async (code) => {
  const pyodide = await (ready ??= loadPyodide());
  let out = "";
  pyodide.setStdout({ batched: (text) => (out += text + "\n") });
  pyodide.setStderr({ batched: () => {} });
  const globals = pyodide.globals.get("dict")();
  try {
    await pyodide.runPythonAsync(code, { globals });
    return { out, error: null };
  } catch (caught) {
    return { out, error: String((caught as Error)?.message ?? caught) };
  } finally {
    globals.destroy();
  }
};
