"use client";

import { useRef, useState, useTransition } from "react";
import { submitReview, type ReviewResult } from "@/lib/review/actions";

/** What the browser is given for a review question. Never the answer. */
export type ReviewView = {
  id: number;
  type: "numeric" | "choice" | "predict";
  promptHtml: string;
  unit?: string;
  items?: string[];
  code?: string;
};

// Review text is written by the model, so the server renders it with raw HTML shown as text.
const Html = ({ html, className }: { html: string; className?: string }) => <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;

/** One review question. It takes one answer, then shows the explanation and the way on. */
export function ReviewCard({ view }: { view: ReviewView }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [failed, setFailed] = useState(false);
  const [text, setText] = useState("");
  const [choice, setChoice] = useState<number | null>(null);
  const startedAt = useRef<number | null>(null);
  const touch = () => {
    startedAt.current ??= Date.now();
  };

  const answered = result !== null && !result.note;
  const locked = answered || pending;

  const submit = (answer: unknown) => {
    touch();
    start(async () => {
      try {
        setFailed(false);
        setResult(await submitReview(view.id, answer, Date.now() - startedAt.current!));
      } catch {
        setFailed(true);
      }
    });
  };
  const checkButton = (disabled: boolean) => (
    <button type="submit" className="btn btn-primary btn-small" disabled={locked || disabled}>
      {pending ? "Checking" : "Check"}
    </button>
  );

  return (
    <>
      <section className="q" aria-label="Review question" data-solved={answered && result.correct} onFocusCapture={touch}>
        <header className="q-head">
          <span className="label">Review question · One try</span>
          {answered ? <span className={result.correct ? "label q-solved" : "label text-error"}>{result.correct ? "Recalled" : "Missed"}</span> : null}
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
              aria-label="Answer to the review question"
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
              <legend className="sr-only">Options for the review question</legend>
              {view.items!.map((html, i) => (
                <label key={i} className="q-option">
                  <input type="radio" name="review-choice" checked={choice === i} onChange={() => (touch(), setChoice(i))} />
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
            <pre className="q-code" tabIndex={0} aria-label="Code for the review question">
              <code>{view.code}</code>
            </pre>
            <textarea
              className="input q-predict"
              aria-label="What the code prints"
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

        <div aria-live="polite" className="q-feedback">
          {failed ? <p className="text-error">Could not reach Axiom. Check your connection and try again.</p> : null}
          {result?.note ? <p className="text-error">{result.note}</p> : null}
          {answered && !result.correct ? (
            <>
              <p className="text-error">Not this time. The answer is:</p>
              <Html html={result.answerHtml ?? ""} className="q-explanation review-answer" />
            </>
          ) : null}
          {answered && result.explanationHtml ? <Html html={result.explanationHtml} className="q-explanation" /> : null}
        </div>
      </section>

      <footer className="lesson-end" aria-live="polite">
        {answered ? (
          <>
            <p className="lesson-end-title">{result.correct ? "Recalled." : "Missed, so it comes back sooner."}</p>
            <p className="text-ink-secondary">
              This lesson comes back in {result.nextInDays} {result.nextInDays === 1 ? "day" : "days"}, with a different question.
            </p>
            {/* A full page load, so the server chooses what comes next from fresh progress. */}
            <a className="btn btn-primary" href="/learn">
              Continue
            </a>
          </>
        ) : (
          <p className="text-ink-secondary">Answer from memory. Learn carries on once you have answered.</p>
        )}
      </footer>
    </>
  );
}
