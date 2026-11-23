"use client";

import { useState, type ComponentType, type ReactNode } from "react";
import type { FigureName } from "@/lib/lessons/figures";

/*
 * Every figure is drawn here as interactive SVG. None is an image file.
 * Each has a text description of its current state, so it reads the same to a
 * screen reader as it looks, and every control is a real button or slider.
 */

type Props = Record<string, unknown>;
const num = (value: unknown, fallback: number) => (typeof value === "number" && Number.isFinite(value) ? value : fallback);
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const group = (n: number) => n.toLocaleString("en-IN");

function Frame({ title, summary, children, controls }: { title: string; summary: string; children: ReactNode; controls: ReactNode }) {
  return (
    <figure className="fig">
      <figcaption className="label">{title}</figcaption>
      <div className="fig-stage">{children}</div>
      <p className="fig-summary" aria-live="polite">
        {summary}
      </p>
      <div className="fig-controls">{controls}</div>
    </figure>
  );
}

function Stepper({ label, value, onChange, min, max }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number }) {
  return (
    <span className="fig-stepper">
      <span className="label">{label}</span>
      <button type="button" className="q-move" aria-label={`Decrease ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)}>
        −
      </button>
      <output className="fig-value">{value}</output>
      <button type="button" className="q-move" aria-label={`Increase ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)}>
        +
      </button>
    </span>
  );
}

function Slider({ label, value, onChange, min, max, step = 1 }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number }) {
  return (
    <label className="fig-slider">
      <span className="label">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

const PLACES = ["ones", "tens", "hundreds", "thousands", "ten thousands", "lakhs"];

/** A number as digits in columns. Each column is worth ten of the column to its right. */
function PlaceValue(props: Props) {
  const columns = clamp(num(props.columns, 4), 2, 6);
  const [value, setValue] = useState(clamp(num(props.start, 207), 0, 10 ** columns - 1));
  const digits = Array.from({ length: columns }, (_, i) => Math.floor(value / 10 ** (columns - 1 - i)) % 10);
  const width = 88;
  const parts = digits.map((d, i) => d * 10 ** (columns - 1 - i)).filter((part) => part > 0);
  const add = (by: number) => setValue((v) => clamp(v + by, 0, 10 ** columns - 1));
  return (
    <Frame
      title="Place value"
      summary={`${group(value)} = ${parts.length ? parts.map(group).join(" + ") : "0"}`}
      controls={
        <>
          {[1, 10, 100].map((by) => (
            <span key={by} className="fig-stepper">
              <button type="button" className="btn btn-secondary btn-small" onClick={() => add(-by)}>
                −{by}
              </button>
              <button type="button" className="btn btn-secondary btn-small" onClick={() => add(by)}>
                +{by}
              </button>
            </span>
          ))}
        </>
      }
    >
      <svg viewBox={`0 0 ${columns * width} 150`} role="img" aria-label={`The digits of ${value} in place-value columns`}>
        {digits.map((digit, i) => {
          const place = columns - 1 - i;
          return (
            <g key={i} transform={`translate(${i * width} 0)`}>
              <rect x="4" y="4" width={width - 8} height="142" className="fig-cell" />
              <text x={width / 2} y="26" className="fig-small" textAnchor="middle">
                {PLACES[place]}
              </text>
              <text x={width / 2} y="88" className="fig-digit" textAnchor="middle">
                {digit}
              </text>
              <text x={width / 2} y="130" className="fig-small" textAnchor="middle">
                {digit} × {group(10 ** place)}
              </text>
            </g>
          );
        })}
      </svg>
    </Frame>
  );
}

/** A point that moves along a number line in equal steps, possibly below zero or between whole numbers. */
function NumberLine(props: Props) {
  const min = num(props.min, 0);
  const max = num(props.max, 10);
  const parts = clamp(num(props.parts, 1), 1, 12); // steps per unit
  const [ticks, setTicks] = useState(Math.round(num(props.start, min) * parts));
  const [from] = useState(ticks);
  const x = (t: number) => 30 + ((t / parts - min) / (max - min)) * 540;
  const name = (t: number) => {
    if (parts === 1 || t % parts === 0) return String(t / parts);
    return `${t < 0 ? "−" : ""}${Math.abs(t)}/${parts}`;
  };
  const moved = ticks - from;
  return (
    <Frame
      title="Number line"
      summary={
        moved === 0
          ? `The point is at ${name(ticks)}.`
          : `Started at ${name(from)}, moved ${Math.abs(moved)} step${Math.abs(moved) === 1 ? "" : "s"} ${moved > 0 ? "right" : "left"}, now at ${name(ticks)}.`
      }
      controls={
        <>
          <button type="button" className="btn btn-secondary btn-small" disabled={ticks <= min * parts} onClick={() => setTicks(ticks - 1)}>
            Step left
          </button>
          <button type="button" className="btn btn-secondary btn-small" disabled={ticks >= max * parts} onClick={() => setTicks(ticks + 1)}>
            Step right
          </button>
        </>
      }
    >
      <svg viewBox="0 0 600 90" role="img" aria-label={`Number line from ${min} to ${max} with a point at ${name(ticks)}`}>
        <line x1="20" y1="45" x2="580" y2="45" className="fig-axis" />
        {Array.from({ length: (max - min) * parts + 1 }, (_, i) => {
          const t = min * parts + i;
          const whole = t % parts === 0;
          return (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={whole ? 35 : 40} y2={whole ? 55 : 50} className="fig-axis" />
              {whole ? (
                <text x={x(t)} y="76" textAnchor="middle" className="fig-small">
                  {String(t / parts).replace("-", "−")}
                </text>
              ) : null}
            </g>
          );
        })}
        {moved !== 0 ? <line x1={x(from)} x2={x(ticks)} y1="22" y2="22" className="fig-accent-line" /> : null}
        <circle cx={x(ticks)} cy="45" r="7" className="fig-accent" />
      </svg>
    </Frame>
  );
}

/** Multiplication as the area of a rectangle, split to show the distributive law. */
function AreaGrid(props: Props) {
  const [rows, setRows] = useState(clamp(num(props.rows, 3), 1, 9));
  const [cols, setCols] = useState(clamp(num(props.columns, 12), 2, 15));
  const [split, setSplit] = useState(clamp(num(props.split, 10), 1, 14));
  const cut = Math.min(split, cols - 1);
  const cell = 28;
  return (
    <Frame
      title="Multiplication as area"
      summary={`${rows} × ${cols} = ${rows} × ${cut} + ${rows} × ${cols - cut} = ${rows * cut} + ${rows * (cols - cut)} = ${rows * cols}`}
      controls={
        <>
          <Stepper label="rows" value={rows} onChange={setRows} min={1} max={9} />
          <Stepper label="columns" value={cols} onChange={setCols} min={2} max={15} />
          <Slider label="split" value={cut} onChange={setSplit} min={1} max={cols - 1} />
        </>
      }
    >
      <svg viewBox={`0 0 ${15 * cell + 8} ${9 * cell + 8}`} role="img" aria-label={`A grid of ${rows} rows and ${cols} columns, split after column ${cut}`}>
        {Array.from({ length: rows * cols }, (_, i) => {
          const [r, c] = [Math.floor(i / cols), i % cols];
          return <rect key={i} x={4 + c * cell} y={4 + r * cell} width={cell - 3} height={cell - 3} className={c < cut ? "fig-accent" : "fig-fill"} />;
        })}
      </svg>
    </Frame>
  );
}

/** A whole cut into equal parts, some shaded, and the same amount cut more finely. */
function FractionBar(props: Props) {
  const [den, setDen] = useState(clamp(num(props.denominator, 4), 1, 12));
  const [n, setN] = useState(clamp(num(props.numerator, 3), 0, 24));
  const [finer, setFiner] = useState(clamp(num(props.finer, 1), 1, 4));
  const top = Math.min(n, den * 2);
  const bar = (y: number, parts: number, shaded: number) =>
    Array.from({ length: parts * 2 }, (_, i) => (
      <rect key={`${y}-${i}`} x={10 + (i * 280) / parts} y={y} width={280 / parts - 2} height="34" className={i < shaded ? "fig-accent" : i < parts ? "fig-fill" : "fig-ghost"} />
    ));
  return (
    <Frame
      title="Fractions"
      summary={
        finer === 1
          ? `${top}/${den}: the whole is cut into ${den} equal parts and ${top} are taken.${top > den ? " That is more than one whole." : ""}`
          : `${top}/${den} = ${top * finer}/${den * finer}: every part was cut into ${finer}, so there are ${finer} times as many parts and ${finer} times as many taken.`
      }
      controls={
        <>
          <Stepper label="parts taken" value={top} onChange={setN} min={0} max={den * 2} />
          <Stepper label="parts in a whole" value={den} onChange={setDen} min={1} max={12} />
          <Stepper label="cut each part into" value={finer} onChange={setFiner} min={1} max={4} />
        </>
      }
    >
      <svg viewBox="0 0 580 110" role="img" aria-label={`Two bars, each showing ${top} parts out of ${den}; the lower bar is cut ${finer} times finer`}>
        {bar(10, den, top)}
        {bar(62, den * finer, top * finer)}
        <line x1="290" x2="290" y1="2" y2="104" className="fig-axis" strokeDasharray="4 4" />
      </svg>
    </Frame>
  );
}

const SCALE: Record<number, string> = {
  [-9]: "a billionth",
  [-6]: "a millionth",
  [-3]: "a thousandth",
  [-2]: "a hundredth",
  [-1]: "a tenth",
  0: "one",
  1: "ten",
  2: "a hundred",
  3: "a thousand",
  6: "a million",
  9: "a billion",
  12: "a trillion",
};

/** Ten multiplied by itself, or divided away, one step at a time. */
function PowersOfTen(props: Props) {
  const [n, setN] = useState(clamp(num(props.start, 3), -9, 12));
  const written = n >= 0 ? "1" + "0".repeat(n) : "0." + "0".repeat(-n - 1) + "1";
  const spaced = n >= 0 ? written.replace(/\B(?=(\d{3})+$)/g, " ") : written;
  return (
    <Frame
      title="Powers of ten"
      summary={`10 to the power ${String(n).replace("-", "−")} is ${spaced}${SCALE[n] ? `, ${SCALE[n]}` : ""}. Each step right multiplies by ten; each step left divides by ten.`}
      controls={<Slider label="exponent" value={n} onChange={setN} min={-9} max={12} />}
    >
      <svg viewBox="0 0 600 110" role="img" aria-label={`10 to the power ${n} written out as ${spaced}`}>
        <text x="300" y="50" textAnchor="middle" className="fig-digit">
          10
          <tspan dy="-18" fontSize="20">
            {String(n).replace("-", "−")}
          </tspan>
        </text>
        <text x="300" y="92" textAnchor="middle" className="fig-mono">
          {spaced}
        </text>
      </svg>
    </Frame>
  );
}

/** Two quantities that grow together: multiply one and the other is multiplied by the same number. */
function RatioTable(props: Props) {
  const a = clamp(num(props.a, 4), 1, 20);
  const b = clamp(num(props.b, 1), 1, 20);
  const [k, setK] = useState(clamp(num(props.start, 1), 1, 12));
  const names = [String(props.first ?? "first"), String(props.second ?? "second")];
  const scale = 560 / ((a + b) * 12);
  return (
    <Frame
      title="Ratio"
      summary={`${a * k} ${names[0]} to ${b * k} ${names[1]}: both are ${k} times the base amounts ${a} and ${b}, so the ratio is still ${a} : ${b}. Total ${(a + b) * k}.`}
      controls={<Slider label="multiply both by" value={k} onChange={setK} min={1} max={12} />}
    >
      <svg viewBox="0 0 600 80" role="img" aria-label={`A bar of ${a * k} ${names[0]} beside ${b * k} ${names[1]}`}>
        <rect x="20" y="20" width={a * k * scale} height="36" className="fig-accent" />
        <rect x={20 + a * k * scale + 3} y="20" width={b * k * scale} height="36" className="fig-fill" />
        <text x="20" y="74" className="fig-small">
          {a * k} {names[0]}
        </text>
        <text x={20 + a * k * scale + 3} y="14" className="fig-small">
          {b * k} {names[1]}
        </text>
      </svg>
    </Frame>
  );
}

const FIGURES: Record<FigureName, ComponentType<Props>> = {
  "place-value": PlaceValue,
  "number-line": NumberLine,
  "area-grid": AreaGrid,
  "fraction-bar": FractionBar,
  "powers-of-ten": PowersOfTen,
  "ratio-table": RatioTable,
};

export function Figure({ name, props }: { name: string; props?: Props }) {
  const Drawn = (FIGURES as Record<string, ComponentType<Props>>)[name];
  return Drawn ? <Drawn {...(props ?? {})} /> : null;
}
