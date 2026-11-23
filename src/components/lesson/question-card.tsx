"use client";

import { useRef, useState, useTransition } from "react";
import { nextHint, submitAnswer } from "@/lib/learning/actions";
import type { QuestionView } from "@/lib/lessons/content";
import { useWorkspace } from "../workspace/context";

const Html = ({ html, className }: { html: string; className?: string }) => (
  // Lesson text is written and reviewed in this repository; nothing a visitor types is ever rendered this way.
  <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
);

export function QuestionCard({ view }: { view: QuestionView }) {
  const ws = useWorkspace();
  const [pending, start] = useTransition();
  const [hints, setHints] = useState(view.hints);
  const [feedback, setFeedback] = useState<{ note?: string; explanationHtml?: string; offline?: boolean } | null>(null);
  const [text, setText] = useState("");
  const [choice, setChoice] = useState<number | null>(null);
  const [order, setOrder] = useState(() => (view.items ?? []).map((_, i) => i));
  const startedAt = useRef<number | null>(null);
  const touch = () => {
    startedAt.current ??= Date.now();
  };

  const verdict = ws.verdicts[view.id];
  const solved = view.solved || ws.solved.has(view.id);
  const explanation = view.explanationHtml ?? feedback?.explanationHtml ?? verdict?.explanationHtml;
  const note = view.type === "code" ? (verdict && !verdict.correct ? verdict.note : undefined) : feedback?.note;
  const wrong = !solved && (view.type === "code" ? verdict?.correct === false : feedback !== null);
  const name = `Question ${view.number}`;

  const submit = (answer: unknown) => {
    touch();
    start(async () => {
      try {
        const result = await submitAnswer(ws.conceptId, view.id, answer, Date.now() - startedAt.current!);
        ws.settle(view.id, result);
        setFeedback({ note: result.note, explanationHtml: result.explanationHtml });
      } catch {
        setFeedback({ note: "Could not reach Axiom. Check your connection and try again.", offline: true });
      }
    });
  };
  const hint = () =>
    start(async () => {
      try {
        setHints(await nextHint(ws.conceptId, view.id));
      } catch {}
    });

  const move = (from: number, by: -1 | 1) => {
    touch();
    setOrder((before) => {
      const next = [...before];
      [next[from], next[from + by]] = [next[from + by], next[from]];
      return next;
    });
  };

  const locked = solved || pending;
  const checkButton = (disabled: boolean) => (
    <button type="submit" className="btn btn-primary btn-small" disabled={locked || disabled}>
      {pending ? "Checking" : "Check"}
    </button>
  );

  return (
    <section className="q" aria-label={name} data-solved={solved} data-question={view.id} onFocusCapture={touch}>
      <header className="q-head">
        <span className="label">
          {name} · {view.system === "s1" ? "Quick" : "Think"}
        </span>
        {solved ? <span className="label q-solved">Solved</span> : null}
      </header>
      <Html html={view.promptHtml} className="q-prompt" />

      {view.type === "numeric" ? (
        <form
          className="q-row"
          onSubmit={(event) => {
            event.preventDefault();
            submit(text);
          }}
        >
          <input
            className="input q-input"
            aria-label={`Answer to ${name.toLowerCase()}`}
            value={text}
            onChange={(event) => setText(event.target.value)}
            disabled={locked}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          {view.unit ? <span className="text-ink-secondary">{view.unit}</span> : null}
          {checkButton(text.trim() === "")}
        </form>
      ) : null}

      {view.type === "choice" ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit(choice);
          }}
        >
          <fieldset className="q-options" disabled={locked}>
            <legend className="sr-only">Options for {name.toLowerCase()}</legend>
            {view.items!.map((html, i) => (
              <label key={i} className="q-option">
                <input type="radio" name={`${view.id}-choice`} checked={choice === i} onChange={() => (touch(), setChoice(i))} />
                <span dangerouslySetInnerHTML={{ __html: html }} />
              </label>
            ))}
          </fieldset>
          <div className="q-row">{checkButton(choice === null)}</div>
        </form>
      ) : null}

      {view.type === "predict" ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit(text);
          }}
        >
          <pre className="q-code" tabIndex={0} aria-label={`Code for ${name.toLowerCase()}`}>
            <code>{view.code}</code>
          </pre>
          <textarea
            className="input q-predict"
            aria-label={`What the code prints, for ${name.toLowerCase()}`}
            placeholder="Type exactly what this prints"
            rows={Math.min(8, Math.max(2, text.split("\n").length))}
            value={text}
            onChange={(event) => setText(event.target.value)}
            disabled={locked}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <div className="q-row">{checkButton(text.trim() === "")}</div>
        </form>
      ) : null}

      {view.type === "order" ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit(order);
          }}
        >
          <ol className="q-steps">
            {order.map((item, position) => (
              <li key={item} className="q-step">
                <span className="label">{position + 1}</span>
                <span className="q-step-text" dangerouslySetInnerHTML={{ __html: view.items![item] }} />
                <button
                  type="button"
                  className="q-move"
                  aria-label={`Move step ${position + 1} up`}
                  disabled={locked || position === 0}
                  onClick={() => move(position, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="q-move"
                  aria-label={`Move step ${position + 1} down`}
                  disabled={locked || position === order.length - 1}
                  onClick={() => move(position, 1)}
                >
                  ↓
                </button>
              </li>
            ))}
          </ol>
          <div className="q-row">{checkButton(false)}</div>
        </form>
      ) : null}

      {view.type === "code" ? (
        <div className="q-row">
          {ws.active === view.id ? (
            <>
              <button type="button" className="btn btn-primary btn-small" onClick={ws.check} disabled={ws.busy}>
                {ws.busy ? "Checking" : "Check my code"}
              </button>
              <span className="text-ink-secondary text-[14px]">This question is open in the editor.</span>
            </>
          ) : (
            <button
              type="button"
              className={`btn btn-small ${solved ? "btn-secondary" : "btn-primary"}`}
              onClick={() => ws.open({ id: view.id, number: view.number, starter: view.starter ?? "" })}
            >
              {view.mode === "find-bug" ? "Open the broken code" : "Open in the editor"}
            </button>
          )}
        </div>
      ) : null}

      <div aria-live="polite" className="q-feedback">
        {wrong ? <p className="text-error">{note ?? "Not yet. Look again and try once more."}</p> : null}
        {solved && explanation ? <Html html={explanation} className="q-explanation" /> : null}
      </div>

      {!solved ? (
        <div className="q-hints">
          {hints.length > 0 ? (
            <ol>
              {hints.map((html, i) => (
                <li key={i}>
                  <span className="label">Hint {i + 1}</span>
                  <span dangerouslySetInnerHTML={{ __html: html }} />
                </li>
              ))}
            </ol>
          ) : null}
          {hints.length < view.hintCount ? (
            <button type="button" className="q-hint-button label" onClick={hint} disabled={pending}>
              {hints.length === 0 ? "Hint" : "Another hint"} · {hints.length} of {view.hintCount} used
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/** Progress through the lesson's questions, and the way on once all are solved. */
export function LessonEnd() {
  const ws = useWorkspace();
  return (
    <footer className="lesson-end" aria-live="polite">
      <p className="label">
        {ws.solved.size} of {ws.total} questions solved
      </p>
      {ws.complete ? (
        <>
          <p className="lesson-end-title">Lesson complete.</p>
          {/* A full page load, so the server chooses the next lesson from fresh progress. */}
          <a className="btn btn-primary" href="/learn">
            Continue
          </a>
        </>
      ) : (
        <p className="text-ink-secondary">Solve every question to finish this lesson. The next one builds on it.</p>
      )}
    </footer>
  );
}
