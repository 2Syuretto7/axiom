"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { PythonRunner, type RunResult } from "@/lib/python/runner";
import { ThemeToggle } from "../theme";
import { CodeEditor, type EditorHandle } from "./code-editor";
import { SymbolBar } from "./symbol-bar";

type Pane = "lesson" | "code";

function load(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function Workspace({
  id,
  breadcrumb,
  starterCode,
  children,
}: {
  id: string;
  breadcrumb: string[];
  starterCode: string;
  children: React.ReactNode;
}) {
  const storageKey = `axiom-code:${id}`;
  const [pane, setPane] = useState<Pane>("lesson");
  const [split, setSplit] = useState(50);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [saved, setSaved] = useState(true);
  const [initial] = useState(() => (typeof window === "undefined" ? starterCode : load(storageKey, starterCode)));
  const code = useRef(initial);
  const editor = useRef<EditorHandle>(null);
  const runner = useRef<PythonRunner | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const main = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const instance = new PythonRunner();
    runner.current = instance;
    instance.warm();
    return () => instance.dispose();
  }, []);

  const onChange = useCallback(
    (next: string) => {
      code.current = next;
      setSaved(false);
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        try {
          localStorage.setItem(storageKey, next);
          setSaved(true);
        } catch {}
      }, 400);
    },
    [storageKey],
  );

  const run = useCallback(async () => {
    if (!runner.current || running) return;
    setRunning(true);
    setPane("code");
    setResult(await runner.current.run(code.current));
    setRunning(false);
  }, [running]);

  const stop = () => runner.current?.stop();

  // Keyboard shortcuts that work wherever focus is.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key === "Enter") {
        event.preventDefault();
        void run();
      } else if (event.altKey && event.key === "1") {
        setPane("lesson");
      } else if (event.altKey && event.key === "2") {
        setPane("code");
        editor.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run]);

  const drag = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = main.current?.getBoundingClientRect();
    if (!box) return;
    const vertical = getComputedStyle(main.current!).getPropertyValue("--stack").trim() === "1";
    const move = (e: PointerEvent) => {
      const ratio = vertical ? (e.clientY - box.top) / box.height : (e.clientX - box.left) / box.width;
      setSplit(Math.round(Math.max(25, Math.min(75, ratio * 100))));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    event.preventDefault();
  };

  return (
    <div className="ws" data-pane={pane}>
      <header className="ws-top">
        <Link href="/" className="font-mono text-[13px] tracking-[0.32em] text-ink" aria-label="Axiom home">
          AXIOM
        </Link>
        <ol className="ws-crumbs label" aria-label="Where you are">
          {breadcrumb.map((part, i) => (
            <li key={i}>{part}</li>
          ))}
        </ol>
        <div className="ml-auto flex items-center gap-6">
          <span className="label hidden sm:inline" role="status">
            {saved ? "Saved" : "Saving"}
          </span>
          <ThemeToggle />
        </div>
      </header>

      <div ref={main} className="ws-main" style={{ "--split": `${split}%` } as React.CSSProperties}>
        <section className="ws-pane ws-lesson" aria-label="Lesson">
          <div className="ws-scroll">{children}</div>
        </section>

        <div
          className="ws-divider"
          role="separator"
          aria-label="Resize panes"
          aria-valuenow={split}
          aria-valuemin={25}
          aria-valuemax={75}
          tabIndex={0}
          onPointerDown={drag}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowUp") setSplit((s) => Math.max(25, s - 5));
            if (event.key === "ArrowRight" || event.key === "ArrowDown") setSplit((s) => Math.min(75, s + 5));
          }}
        />

        <section className="ws-pane ws-code" aria-label="Code">
          <div className="ws-toolbar">
            <span className="label">Python</span>
            <div className="ml-auto flex items-center gap-2">
              {running ? (
                <button type="button" className="btn btn-secondary btn-small" onClick={stop}>
                  Stop
                </button>
              ) : null}
              <button type="button" className="btn btn-primary btn-small" onClick={run} disabled={running}>
                {running ? "Running" : "Run"}
                <kbd className="ws-kbd" aria-hidden="true">
                  Ctrl ↵
                </kbd>
              </button>
            </div>
          </div>
          <div className="ws-editor">
            <CodeEditor ref={editor} initial={initial} onChange={onChange} onRun={run} label="Python code editor" />
          </div>
          <SymbolBar editor={editor} />
          <div className="ws-output" role="region" aria-label="Output" aria-live="polite" tabIndex={0}>
            <p className="label mb-2">Output{result && !result.timedOut ? ` · ${Math.max(1, Math.round(result.ms))} ms` : ""}</p>
            {result === null ? (
              <p className="text-ink-faint">Run your code to see what it prints.</p>
            ) : (
              <pre data-testid="output" className="ws-pre">
                {result.out.map((chunk, i) => (
                  <span key={i} className={chunk.stream === "err" ? "text-error" : undefined}>
                    {chunk.text}
                    {"\n"}
                  </span>
                ))}
                {result.error ? <span className="text-error">{result.error}</span> : null}
                {!result.error && result.out.length === 0 ? <span className="text-ink-faint">No output.</span> : null}
                {result.truncated ? <span className="text-ink-faint">{"\n"}Output was cut short.</span> : null}
              </pre>
            )}
          </div>
        </section>
      </div>

      <nav className="ws-tabs" aria-label="Panes">
        {(["lesson", "code"] as const).map((name) => (
          <button key={name} type="button" className="ws-tab" aria-pressed={pane === name} onClick={() => setPane(name)}>
            {name === "lesson" ? "Lesson" : "Code"}
          </button>
        ))}
      </nav>
    </div>
  );
}
