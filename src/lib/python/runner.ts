export type OutputChunk = { stream: "out" | "err"; text: string };
export type RunResult = {
  out: OutputChunk[];
  error: string | null;
  ms: number;
  timedOut: boolean;
  truncated: boolean;
};

type Pending = { resolve: (r: RunResult) => void; timer?: ReturnType<typeof setTimeout> };

/**
 * Owns the Python worker. A run that exceeds its time limit, or is stopped by
 * the learner, is ended by terminating the worker; the next run starts a new one.
 */
export class PythonRunner {
  private worker: Worker | null = null;
  private pending = new Map<number, Pending>();
  private nextId = 1;

  private ensure(): Worker {
    if (this.worker) return this.worker;
    const worker = new Worker("/py-worker.mjs", { type: "module" });
    worker.onmessage = (event) => {
      const { id, type, out, error, ms, truncated } = event.data;
      const entry = this.pending.get(id);
      if (!entry || type !== "done") return;
      clearTimeout(entry.timer);
      this.pending.delete(id);
      entry.resolve({ out, error, ms, timedOut: false, truncated });
    };
    worker.onerror = () => this.abort("Python could not start. Reload the page and try again.", false);
    this.worker = worker;
    return worker;
  }

  /** Start loading Python before the first run, so that run feels instant. */
  warm() {
    this.ensure().postMessage({ id: 0, type: "warm" });
  }

  run(code: string, timeoutMs = 10_000): Promise<RunResult> {
    const id = this.nextId++;
    return new Promise((resolve) => {
      const timer = setTimeout(
        () => this.abort(`Stopped after ${Math.round(timeoutMs / 1000)} seconds. Look for a loop that never ends.`, true),
        timeoutMs,
      );
      this.pending.set(id, { resolve, timer });
      this.ensure().postMessage({ id, type: "run", code });
    });
  }

  stop() {
    this.abort("Stopped.", true);
  }

  private abort(message: string, timedOut: boolean) {
    this.worker?.terminate();
    this.worker = null;
    for (const entry of this.pending.values()) {
      clearTimeout(entry.timer);
      entry.resolve({ out: [], error: message, ms: 0, timedOut, truncated: false });
    }
    this.pending.clear();
  }

  dispose() {
    this.worker?.terminate();
    this.worker = null;
    this.pending.clear();
  }
}
