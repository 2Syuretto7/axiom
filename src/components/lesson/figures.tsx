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

const fmt = (n: number) => {
  const text = Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return text.replace("-", "−");
};
/** Writes c1·name1 + c2·name2 + … as people write it: no "1x", no "+ −", no zero terms. */
const sumOf = (terms: [number, string][]) => {
  const kept = terms.filter(([k]) => k !== 0);
  if (kept.length === 0) return "0";
  return kept
    .map(([k, name], i) => {
      const size = Math.abs(k);
      const body = name === "" ? fmt(size) : `${size === 1 ? "" : fmt(size)}${name}`;
      return i === 0 ? `${k < 0 ? "−" : ""}${body}` : `${k < 0 ? "−" : "+"} ${body}`;
    })
    .join(" ");
};

const REACH = 8; // the plane runs from −8 to 8 both ways
const UNIT = 20;
const px = (x: number) => 170 + x * UNIT;
const py = (y: number) => 170 - y * UNIT;

function PlaneGrid({ label, children }: { label: string; children: ReactNode }) {
  const marks = Array.from({ length: 2 * REACH + 1 }, (_, i) => i - REACH);
  return (
    <svg viewBox="0 0 340 340" role="img" aria-label={label}>
      <defs>
        <clipPath id="plane-clip">
          <rect x={px(-REACH)} y={py(REACH)} width={2 * REACH * UNIT} height={2 * REACH * UNIT} />
        </clipPath>
      </defs>
      {marks.map((k) => (
        <g key={k}>
          <line x1={px(k)} x2={px(k)} y1={py(-REACH)} y2={py(REACH)} className="fig-grid" />
          <line y1={py(k)} y2={py(k)} x1={px(-REACH)} x2={px(REACH)} className="fig-grid" />
          {k !== 0 && k % 2 === 0 ? (
            <>
              <text x={px(k)} y={py(0) + 13} textAnchor="middle" className="fig-small">
                {fmt(k)}
              </text>
              <text x={px(0) - 5} y={py(k) + 4} textAnchor="end" className="fig-small">
                {fmt(k)}
              </text>
            </>
          ) : null}
        </g>
      ))}
      <line x1={px(-REACH)} x2={px(REACH)} y1={py(0)} y2={py(0)} className="fig-axis" />
      <line y1={py(-REACH)} y2={py(REACH)} x1={px(0)} x2={px(0)} className="fig-axis" />
      <text x={px(REACH) - 2} y={py(0) - 6} textAnchor="end" className="fig-small">
        x
      </text>
      <text x={px(0) + 6} y={py(REACH) + 10} className="fig-small">
        y
      </text>
      <g clipPath="url(#plane-clip)">{children}</g>
    </svg>
  );
}

/** A point named by two numbers: how far across, then how far up. */
function PlanePoint(props: Props) {
  const [x, setX] = useState(clamp(Math.round(num(props.x, 3)), -REACH, REACH));
  const [y, setY] = useState(clamp(Math.round(num(props.y, 2)), -REACH, REACH));
  const across = x === 0 ? "neither left nor right" : `${Math.abs(x)} ${x > 0 ? "right" : "left"}`;
  const up = y === 0 ? "neither up nor down" : `${Math.abs(y)} ${y > 0 ? "up" : "down"}`;
  const where =
    x === 0 && y === 0
      ? "It is the origin."
      : x === 0
        ? "It lies on the y-axis."
        : y === 0
          ? "It lies on the x-axis."
          : `It is in quadrant ${x > 0 ? (y > 0 ? "I" : "IV") : y > 0 ? "II" : "III"}.`;
  const square = x * x + y * y;
  const root = Math.sqrt(square);
  return (
    <Frame
      title="Coordinates"
      summary={`The point (${fmt(x)}, ${fmt(y)}): ${across}, ${up}. ${where} Distance from the origin: ${Number.isInteger(root) ? fmt(root) : `√${square} ≈ ${fmt(root)}`}.`}
      controls={
        <>
          <Stepper label="x" value={x} onChange={setX} min={-REACH} max={REACH} />
          <Stepper label="y" value={y} onChange={setY} min={-REACH} max={REACH} />
        </>
      }
    >
      <PlaneGrid label={`The coordinate plane with a point at (${x}, ${y})`}>
        <line x1={px(x)} x2={px(x)} y1={py(0)} y2={py(y)} className="fig-guide" />
        <line x1={px(0)} x2={px(x)} y1={py(y)} y2={py(y)} className="fig-guide" />
        <circle cx={px(x)} cy={py(y)} r="6" className="fig-accent" />
      </PlaneGrid>
    </Frame>
  );
}

const lineName = (m: number, b: number) => `y = ${sumOf([[m, "x"], [b, ""]])}`;
const drawLine = (m: number, b: number, className: string) => (
  <line x1={px(-REACH - 1)} y1={py(m * (-REACH - 1) + b)} x2={px(REACH + 1)} y2={py(m * (REACH + 1) + b)} className={className} />
);

/** A straight line steered by its slope and its intercept, with the slope drawn as a step. */
function PlaneLine(props: Props) {
  const [m, setM] = useState(clamp(num(props.slope, 2), -4, 4));
  const [b, setB] = useState(clamp(num(props.intercept, 1), -6, 6));
  const rise = m === 0 ? "stays level" : `goes ${m > 0 ? "up" : "down"} ${fmt(Math.abs(m))}`;
  return (
    <Frame
      title="Straight line"
      summary={`${lineName(m, b)}. It crosses the y-axis at ${fmt(b)}. For each 1 step to the right it ${rise}.`}
      controls={
        <>
          <Slider label="slope" value={m} onChange={setM} min={-4} max={4} step={0.5} />
          <Slider label="intercept" value={b} onChange={setB} min={-6} max={6} />
        </>
      }
    >
      <PlaneGrid label={`The line ${lineName(m, b)}`}>
        {drawLine(m, b, "fig-accent-line")}
        <line x1={px(0)} x2={px(1)} y1={py(b)} y2={py(b)} className="fig-line" />
        <line x1={px(1)} x2={px(1)} y1={py(b)} y2={py(b + m)} className="fig-line" />
        <circle cx={px(0)} cy={py(b)} r="5" className="fig-accent" />
      </PlaneGrid>
    </Frame>
  );
}

/** Two lines. Where they cross is the one pair of numbers that satisfies both equations. */
function PlaneLines(props: Props) {
  const [m, setM] = useState(clamp(num(props.slope, 1), -4, 4));
  const [b, setB] = useState(clamp(num(props.intercept, 1), -6, 6));
  const m2 = clamp(num(props.otherSlope, -1), -4, 4);
  const b2 = clamp(num(props.otherIntercept, 5), -6, 6);
  const x = m === m2 ? null : (b2 - b) / (m - m2);
  const meeting =
    x === null
      ? b === b2
        ? "They are the same line, so every point on it satisfies both equations."
        : "They are parallel and never meet, so no pair satisfies both equations."
      : `They cross at (${fmt(x)}, ${fmt(m * x + b)}), the only pair that satisfies both equations.`;
  return (
    <Frame
      title="Two lines"
      summary={`${lineName(m, b)} and ${lineName(m2, b2)}. ${meeting}`}
      controls={
        <>
          <Slider label="slope" value={m} onChange={setM} min={-4} max={4} step={0.5} />
          <Slider label="intercept" value={b} onChange={setB} min={-6} max={6} />
        </>
      }
    >
      <PlaneGrid label={`The lines ${lineName(m, b)} and ${lineName(m2, b2)}`}>
        {drawLine(m2, b2, "fig-line")}
        {drawLine(m, b, "fig-accent-line")}
        {x === null ? null : <circle cx={px(x)} cy={py(m * x + b)} r="6" className="fig-accent" />}
      </PlaneGrid>
    </Frame>
  );
}

/** The curve y = ax² + bx + c, with its turning point and the places it meets the x-axis. */
function Parabola(props: Props) {
  const [a, setA] = useState(clamp(num(props.a, 1), -2, 2));
  const [b, setB] = useState(clamp(num(props.b, -2), -6, 6));
  const [c, setC] = useState(clamp(num(props.c, -3), -8, 8));
  const name = `y = ${sumOf([[a, "x²"], [b, "x"], [c, ""]])}`;
  const f = (x: number) => a * x * x + b * x + c;
  const points = Array.from({ length: 161 }, (_, i) => -REACH + i / 10)
    .map((x) => `${px(x).toFixed(1)},${py(clamp(f(x), -3 * REACH, 3 * REACH)).toFixed(1)}`)
    .join(" ");
  const disc = b * b - 4 * a * c;
  let detail: string;
  let roots: number[] = [];
  if (a === 0) {
    detail = "With no x² term this is a straight line, not a parabola.";
  } else {
    const h = -b / (2 * a);
    if (disc > 0) roots = [(-b - Math.sqrt(disc)) / (2 * a), (-b + Math.sqrt(disc)) / (2 * a)].sort((p, q) => p - q);
    else if (disc === 0) roots = [h];
    const crossing =
      roots.length === 2
        ? `It crosses the x-axis at ${fmt(roots[0])} and ${fmt(roots[1])}.`
        : roots.length === 1
          ? `It touches the x-axis at ${fmt(roots[0])}.`
          : "It never meets the x-axis.";
    detail = `It opens ${a > 0 ? "upwards" : "downwards"}, with its turning point at (${fmt(h)}, ${fmt(f(h))}). ${crossing} b² − 4ac = ${fmt(disc)}.`;
  }
  return (
    <Frame
      title="Parabola"
      summary={`${name}. ${detail}`}
      controls={
        <>
          <Slider label="a" value={a} onChange={setA} min={-2} max={2} step={0.5} />
          <Slider label="b" value={b} onChange={setB} min={-6} max={6} />
          <Slider label="c" value={c} onChange={setC} min={-8} max={8} />
        </>
      }
    >
      <PlaneGrid label={`The curve ${name}`}>
        <polyline points={points} fill="none" className="fig-accent-line" />
        {roots.map((r) => (
          <circle key={r} cx={px(r)} cy={py(0)} r="5" className="fig-accent" />
        ))}
      </PlaneGrid>
    </Frame>
  );
}

const listOf = (items: number[]) => (items.length === 0 ? "nothing" : items.map(fmt).join(", "));

/** Two sets of whole numbers drawn as overlapping regions, with their union, intersection and differences. */
function Venn(props: Props) {
  const top = 12;
  const [a, setA] = useState(clamp(Math.round(num(props.a, 2)), 2, 6));
  const [b, setB] = useState(clamp(Math.round(num(props.b, 3)), 2, 6));
  const universe = Array.from({ length: top }, (_, i) => i + 1);
  const onlyA = universe.filter((n) => n % a === 0 && n % b !== 0);
  const both = universe.filter((n) => n % a === 0 && n % b === 0);
  const onlyB = universe.filter((n) => n % a !== 0 && n % b === 0);
  const neither = universe.filter((n) => n % a !== 0 && n % b !== 0);
  const column = (items: number[], x: number) =>
    items.map((n, i) => (
      <text key={n} x={x} y={150 - (items.length - 1) * 11 + i * 22} textAnchor="middle" className="fig-mono">
        {n}
      </text>
    ));
  return (
    <Frame
      title="Two sets"
      summary={`Among the numbers 1 to ${top}, A is the multiples of ${a} and B is the multiples of ${b}. In both (A ∩ B): ${listOf(both)}. In at least one (A ∪ B): ${listOf(universe.filter((n) => n % a === 0 || n % b === 0))}. In A but not B (A ∖ B): ${listOf(onlyA)}. In neither: ${listOf(neither)}.`}
      controls={
        <>
          <Stepper label="A: multiples of" value={a} onChange={setA} min={2} max={6} />
          <Stepper label="B: multiples of" value={b} onChange={setB} min={2} max={6} />
        </>
      }
    >
      <svg viewBox="0 0 440 290" role="img" aria-label={`Two overlapping regions for the multiples of ${a} and of ${b} among 1 to ${top}`}>
        <rect x="10" y="10" width="420" height="270" className="fig-ghost" />
        <circle cx="165" cy="145" r="115" className="fig-ghost" />
        <circle cx="275" cy="145" r="115" className="fig-ghost" />
        <text x="80" y="40" className="fig-small">
          A
        </text>
        <text x="352" y="40" className="fig-small">
          B
        </text>
        {column(onlyA, 105)}
        {column(both, 220)}
        {column(onlyB, 335)}
        <text x="20" y="272" className="fig-small">
          outside both: {listOf(neither)}
        </text>
      </svg>
    </Frame>
  );
}

const MAP_RULES: { name: string; f: (x: number, m: number) => number }[] = [
  { name: "x mod m", f: (x, m) => x % m },
  { name: "(x + 1) mod m", f: (x, m) => (x + 1) % m },
  { name: "2x mod m", f: (x, m) => (2 * x) % m },
  { name: "(x // 2) mod m", f: (x, m) => Math.floor(x / 2) % m },
  { name: "x² mod m", f: (x, m) => (x * x) % m },
];

/** A function drawn as arrows from each input to its one output, with the two questions asked of any map. */
function ArrowMap(props: Props) {
  const [n, setN] = useState(clamp(Math.round(num(props.inputs, 4)), 2, 6));
  const [m, setM] = useState(clamp(Math.round(num(props.outputs, 4)), 2, 6));
  const [rule, setRule] = useState(clamp(Math.round(num(props.rule, 1)), 1, MAP_RULES.length));
  const { name, f } = MAP_RULES[rule - 1];
  const inputs = Array.from({ length: n }, (_, i) => i);
  const outputs = Array.from({ length: m }, (_, i) => i);
  const image = inputs.map((x) => f(x, m));
  const missed = outputs.filter((y) => !image.includes(y));
  const clash = inputs.find((x) => image.indexOf(image[x]) !== x);
  const injective = clash === undefined;
  const surjective = missed.length === 0;
  const yIn = (i: number) => 40 + i * 40;
  const kind = injective && surjective ? "a bijection" : injective ? "injective only" : surjective ? "surjective only" : "neither";
  const plain = props.plain === true;
  const head = `f(x) = ${name} with m = ${m}, from {${inputs.join(", ")}} to {${outputs.join(", ")}}. Every input has exactly one arrow.`;
  const range = `The outputs that are reached, the range, are {${outputs.filter((y) => image.includes(y)).join(", ")}}.`;
  return (
    <Frame
      title="Arrow diagram"
      summary={
        plain
          ? `${head} ${range}`
          : `${head} Injective: ${injective ? "yes, no output is hit twice" : `no, inputs ${image.indexOf(image[clash!])} and ${clash} share the output ${image[clash!]}`}. Surjective: ${
              surjective ? "yes, every output is hit" : `no, nothing reaches ${listOf(missed)}`
            }. This map is ${kind}.`
      }
      controls={
        <>
          <Stepper label="rule" value={rule} onChange={setRule} min={1} max={MAP_RULES.length} />
          <Stepper label="inputs" value={n} onChange={setN} min={2} max={6} />
          <Stepper label="outputs (m)" value={m} onChange={setM} min={2} max={6} />
        </>
      }
    >
      <svg viewBox="0 0 440 280" role="img" aria-label={`Arrows from ${n} inputs to ${m} outputs for the rule ${name}`}>
        <text x="110" y="16" textAnchor="middle" className="fig-small">
          inputs
        </text>
        <text x="330" y="16" textAnchor="middle" className="fig-small">
          outputs
        </text>
        {inputs.map((x) => (
          <g key={`in-${x}`}>
            <line x1="128" y1={yIn(x) - 5} x2="312" y2={yIn(image[x]) - 5} className={!plain && (x === clash || (clash !== undefined && x === image.indexOf(image[clash]))) ? "fig-accent-line" : "fig-line"} />
            <text x="110" y={yIn(x)} textAnchor="middle" className="fig-mono">
              {x}
            </text>
          </g>
        ))}
        {outputs.map((y) => (
          <g key={`out-${y}`}>
            <circle cx="318" cy={yIn(y) - 5} r="4" className={image.includes(y) ? "fig-accent" : "fig-ghost"} />
            <text x="340" y={yIn(y)} textAnchor="middle" className="fig-mono">
              {y}
            </text>
          </g>
        ))}
      </svg>
    </Frame>
  );
}

/** A line and its inverse: the same line with the roles of x and y exchanged, its mirror image in y = x. */
function InverseLine(props: Props) {
  const [m, setM] = useState(clamp(num(props.slope, 2), -4, 4));
  const [b, setB] = useState(clamp(num(props.intercept, -2), -6, 6));
  const [x, setX] = useState(clamp(Math.round(num(props.x, 3)), -REACH, REACH));
  const y = m * x + b;
  const detail =
    m === 0
      ? `With slope 0 every input gives ${fmt(b)}, so the output does not tell you the input and there is no inverse.`
      : `Its inverse is ${lineName(1 / m, -b / m).replace("y =", "g(x) =")}. f sends ${fmt(x)} to ${fmt(y)}, and g sends ${fmt(y)} back to ${fmt(x)}: the point (${fmt(x)}, ${fmt(y)}) on f is mirrored to (${fmt(y)}, ${fmt(x)}) on g.`;
  return (
    <Frame
      title="A function and its inverse"
      summary={`${lineName(m, b).replace("y =", "f(x) =")}. ${detail}`}
      controls={
        <>
          <Slider label="slope" value={m} onChange={setM} min={-4} max={4} step={0.5} />
          <Slider label="intercept" value={b} onChange={setB} min={-6} max={6} />
          <Stepper label="x" value={x} onChange={setX} min={-REACH} max={REACH} />
        </>
      }
    >
      <PlaneGrid label={`The line ${lineName(m, b)}, the mirror line y = x, and the inverse`}>
        <line x1={px(-REACH)} y1={py(-REACH)} x2={px(REACH)} y2={py(REACH)} className="fig-guide" />
        {m === 0 ? null : drawLine(1 / m, -b / m, "fig-line")}
        {drawLine(m, b, "fig-accent-line")}
        <circle cx={px(x)} cy={py(y)} r="5" className="fig-accent" />
        {m === 0 ? null : <circle cx={px(y)} cy={py(x)} r="5" className="fig-fill" />}
      </PlaneGrid>
    </Frame>
  );
}

const SPLITS = [1, 2, 4, 12, 52, 365, 8760];
const SPLIT_NAMES = ["once, at the end of the year", "every half-year", "every quarter", "every month", "every week", "every day", "every hour"];

/** One rupee at 100% a year, with the interest paid in more and more instalments: the staircase closes in on e. */
function Growth(props: Props) {
  const [k, setK] = useState(clamp(Math.round(num(props.start, 1)), 1, SPLITS.length));
  const n = SPLITS[k - 1];
  const final = (1 + 1 / n) ** n;
  const gx = (t: number) => 40 + t * 380;
  const gy = (v: number) => 250 - (v - 1) * 125;
  const shown = Math.min(n, 365);
  let stairs = `${gx(0)},${gy(1)}`;
  for (let i = 1; i <= shown; i++) {
    const before = (1 + 1 / n) ** Math.round(((i - 1) * n) / shown);
    const after = (1 + 1 / n) ** Math.round((i * n) / shown);
    stairs += ` ${gx(i / shown).toFixed(1)},${gy(before).toFixed(1)} ${gx(i / shown).toFixed(1)},${gy(after).toFixed(1)}`;
  }
  const curve = Array.from({ length: 101 }, (_, i) => `${gx(i / 100).toFixed(1)},${gy(Math.exp(i / 100)).toFixed(1)}`).join(" ");
  return (
    <Frame
      title="Compound growth"
      summary={`₹1 at 100% a year, interest added ${SPLIT_NAMES[k - 1]}: ${n} step${n === 1 ? "" : "s"}, each multiplying by (1 + 1/${group(n)}). After one year: ₹${final.toFixed(5)}. The limit of ever finer steps is e ≈ 2.71828.`}
      controls={<Stepper label="how often" value={k} onChange={setK} min={1} max={SPLITS.length} />}
    >
      <svg viewBox="0 0 440 280" role="img" aria-label={`Balance over one year with interest added in ${n} steps, against the smooth curve of continuous growth`}>
        <line x1={gx(0)} x2={gx(1)} y1={gy(1)} y2={gy(1)} className="fig-axis" />
        <line x1={gx(0)} x2={gx(0)} y1={gy(1)} y2={gy(2.85)} className="fig-axis" />
        {[1, 2, Math.E].map((v) => (
          <g key={v}>
            <line x1={gx(0)} x2={gx(1)} y1={gy(v)} y2={gy(v)} className="fig-guide" />
            <text x={gx(0) - 6} y={gy(v) + 4} textAnchor="end" className="fig-small">
              {v === Math.E ? "e" : v}
            </text>
          </g>
        ))}
        <text x={gx(1)} y={gy(1) + 16} textAnchor="end" className="fig-small">
          one year
        </text>
        <polyline points={curve} fill="none" className="fig-line" />
        <polyline points={stairs} fill="none" className="fig-accent-line" />
      </svg>
    </Frame>
  );
}

const EXACT: Record<number, string> = { 0: "0", 30: "1/2", 45: "√2/2", 60: "√3/2", 90: "1" };
/** The exact value of the sine of a multiple of 15 degrees where it has a short form, with its decimal. */
const trig = (degrees: number, value: number) => {
  const d = ((degrees % 360) + 360) % 360;
  const reference = d <= 90 ? d : d <= 180 ? 180 - d : d <= 270 ? d - 180 : 360 - d;
  const exact = EXACT[reference];
  const decimal = String(Math.round(value * 1000) / 1000 || 0).replace("-", "−");
  if (exact === undefined || exact === "0" || exact === "1") return decimal;
  return `${value < 0 ? "−" : ""}${exact} ≈ ${decimal}`;
};

/** A point travelling round the circle of radius 1: its two coordinates are the cosine and sine of the angle. */
function UnitCircle(props: Props) {
  const [turns, setTurns] = useState(clamp(Math.round(num(props.degrees, 30) / 15), -24, 48));
  const degrees = turns * 15;
  const radians = (degrees * Math.PI) / 180;
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  const cx = (x: number) => 170 + x * 120;
  const cy = (y: number) => 150 - y * 120;
  const piFraction = (() => {
    const g = (p: number, q: number): number => (q === 0 ? Math.abs(p) : g(q, p % q));
    const d = g(turns, 12) || 1;
    const top = turns / d;
    const bottom = 12 / d;
    if (top === 0) return "0";
    const head = Math.abs(top) === 1 ? "π" : `${Math.abs(top)}π`;
    return `${top < 0 ? "−" : ""}${head}${bottom === 1 ? "" : `/${bottom}`}`;
  })();
  const cosine = trig(90 - degrees, c);
  const sine = trig(degrees, s);
  return (
    <Frame
      title="Unit circle"
      summary={`Angle ${fmt(degrees)}° = ${piFraction} radians. The point on the circle is (cos, sin) = (${cosine}, ${sine}). Check: cos² + sin² = ${fmt(Math.round((c * c + s * s) * 1000) / 1000)}.`}
      controls={<Slider label="angle" value={turns} onChange={setTurns} min={-24} max={48} />}
    >
      <svg viewBox="0 0 340 300" role="img" aria-label={`The unit circle with a point at an angle of ${degrees} degrees`}>
        <line x1={cx(-1.3)} x2={cx(1.3)} y1={cy(0)} y2={cy(0)} className="fig-axis" />
        <line x1={cx(0)} x2={cx(0)} y1={cy(-1.2)} y2={cy(1.2)} className="fig-axis" />
        <circle cx={cx(0)} cy={cy(0)} r="120" className="fig-ghost" />
        <text x={cx(1) + 4} y={cy(0) + 13} className="fig-small">
          1
        </text>
        <text x={cx(0) + 5} y={cy(1) - 4} className="fig-small">
          1
        </text>
        <line x1={cx(0)} y1={cy(0)} x2={cx(c)} y2={cy(s)} className="fig-line" />
        <line x1={cx(0)} y1={cy(0)} x2={cx(c)} y2={cy(0)} className="fig-accent-line" />
        <line x1={cx(c)} y1={cy(0)} x2={cx(c)} y2={cy(s)} className="fig-accent-line" />
        <text x={cx(c / 2)} y={cy(0) + (s >= 0 ? 14 : -6)} textAnchor="middle" className="fig-small">
          cos
        </text>
        <text x={cx(c) + (c >= 0 ? 6 : -6)} y={cy(s / 2) + 4} textAnchor={c >= 0 ? "start" : "end"} className="fig-small">
          sin
        </text>
        <circle cx={cx(c)} cy={cy(s)} r="6" className="fig-accent" />
      </svg>
    </Frame>
  );
}

/** 1 + 2 + … + n as a staircase of squares, and two staircases fitted together into an n by (n + 1) rectangle. */
function TriangleSum(props: Props) {
  const [n, setN] = useState(clamp(Math.round(num(props.n, 4)), 1, 10));
  const size = Math.min(26, 250 / (n + 1));
  const total = (n * (n + 1)) / 2;
  const cells: ReactNode[] = [];
  for (let row = 1; row <= n; row++) {
    for (let col = 1; col <= n + 1; col++) {
      cells.push(<rect key={`${row}-${col}`} x={20 + (col - 1) * size} y={15 + (row - 1) * size} width={size - 2} height={size - 2} className={col <= row ? "fig-accent" : "fig-fill"} />);
    }
  }
  return (
    <Frame
      title="Sum of the first n whole numbers"
      summary={`1 + 2 + … + ${n} is the blue staircase: ${total} squares. A second copy, turned over, completes a rectangle ${n} by ${n + 1} with ${n * (n + 1)} squares, so the staircase is half of it: ${n} × ${n + 1} ÷ 2 = ${total}.`}
      controls={<Stepper label="n" value={n} onChange={setN} min={1} max={10} />}
    >
      <svg viewBox="0 0 340 280" role="img" aria-label={`A staircase of ${total} squares and its copy, forming a rectangle ${n} by ${n + 1}`}>
        {cells}
      </svg>
    </Frame>
  );
}

/** The running totals of a + ar + ar² + …: they settle when the ratio is small, and do not when it is not. */
function PartialSums(props: Props) {
  const [ratio, setRatio] = useState(clamp(num(props.ratio, 0.5), -1.2, 1.2));
  const [count, setCount] = useState(clamp(Math.round(num(props.terms, 6)), 1, 16));
  const sums: number[] = [];
  let term = 1;
  let running = 0;
  for (let i = 0; i < count; i++) {
    running += term;
    sums.push(running);
    term *= ratio;
  }
  const converges = Math.abs(ratio) < 1;
  const limit = converges ? 1 / (1 - ratio) : null;
  const reach = Math.max(2.2, ...sums.map(Math.abs), limit ?? 0) * 1.1;
  const low = Math.min(0, ...sums) < 0 ? -reach : 0;
  const sy = (v: number) => 250 - ((v - low) / (reach - low)) * 230;
  const width = 380 / 16;
  return (
    <Frame
      title="Partial sums of a geometric series"
      summary={`1 + r + r² + … with r = ${fmt(ratio)}. The sum of the first ${count} term${count === 1 ? "" : "s"} is ${fmt(Math.round(sums[count - 1] * 10000) / 10000)}. ${
        limit === null ? "The ratio is not smaller than 1 in size, so the totals never settle: the series diverges." : `The totals close in on 1 ÷ (1 − r) = ${fmt(Math.round(limit * 10000) / 10000)}: the series converges.`
      }`}
      controls={
        <>
          <Slider label="ratio r" value={ratio} onChange={setRatio} min={-1.2} max={1.2} step={0.1} />
          <Stepper label="terms" value={count} onChange={setCount} min={1} max={16} />
        </>
      }
    >
      <svg viewBox="0 0 440 280" role="img" aria-label={`Bars for the first ${count} partial sums of the geometric series with ratio ${ratio}`}>
        <line x1="40" x2="430" y1={sy(0)} y2={sy(0)} className="fig-axis" />
        {limit === null ? null : (
          <>
            <line x1="40" x2="430" y1={sy(limit)} y2={sy(limit)} className="fig-guide" />
            <text x="36" y={sy(limit) + 4} textAnchor="end" className="fig-small">
              {fmt(Math.round(limit * 100) / 100)}
            </text>
          </>
        )}
        <text x="36" y={sy(0) + 4} textAnchor="end" className="fig-small">
          0
        </text>
        {sums.map((v, i) => (
          <rect key={i} x={44 + i * width} y={Math.min(sy(v), sy(0))} width={width - 4} height={Math.max(1, Math.abs(sy(v) - sy(0)))} className={i === count - 1 ? "fig-accent" : "fig-fill"} />
        ))}
      </svg>
    </Frame>
  );
}

const factorialOf = (k: number) => Array.from({ length: k }, (_, i) => i + 1).reduce((a, b) => a * b, 1);

/** The calls of factorial(n) piling up while each waits for the next, then finishing from the top down. */
function CallStack(props: Props) {
  const [n, setN] = useState(clamp(Math.round(num(props.n, 3)), 1, 5));
  const [step, setStep] = useState(0);
  const last = 2 * n + 1;
  const at = Math.min(step, last);
  const returned = Math.max(0, at - n); // how many calls have finished
  const frames = at <= n ? at + 1 : n + 1 - returned; // calls still on the stack
  const top = frames - 1;
  const argOf = (i: number) => n - i;
  let summary: string;
  if (at < n) {
    summary = `Step ${at}: factorial(${argOf(top)}) has been called. ${argOf(top)} is not 0, so it needs factorial(${argOf(top) - 1}) and must wait. ${frames} call${frames === 1 ? " is" : "s are"} on the stack.`;
  } else if (at === n) {
    summary = `Step ${at}: factorial(0) has been called. It is the base case and returns 1 without calling anything. ${frames} calls are on the stack, the deepest it gets.`;
  } else if (at < last) {
    const k = argOf(top);
    summary = `Step ${at}: factorial(${k - 1}) returned ${factorialOf(k - 1)}. factorial(${k}) resumes with its own n = ${k} and computes ${k} × ${factorialOf(k - 1)} = ${factorialOf(k)}. ${frames} call${frames === 1 ? " is" : "s are"} on the stack.`;
  } else {
    summary = `Step ${at}: factorial(${n}) returned ${factorialOf(n)}. The stack is empty. ${n + 1} calls were made in all.`;
  }
  const height = 38;
  return (
    <Frame
      title="The call stack"
      summary={summary}
      controls={
        <>
          <Stepper label="step" value={at} onChange={setStep} min={0} max={last} />
          <Stepper
            label="n"
            value={n}
            onChange={(v) => {
              setN(v);
              setStep(0);
            }}
            min={1}
            max={5}
          />
        </>
      }
    >
      <svg viewBox="0 0 440 280" role="img" aria-label={`The stack of unfinished calls of factorial(${n}) at step ${at}, holding ${frames} call${frames === 1 ? "" : "s"}`}>
        <line x1="60" x2="380" y1="262" y2="262" className="fig-axis" />
        {Array.from({ length: n + 1 }, (_, i) => {
          const y = 262 - (i + 1) * (height + 4);
          const live = i < frames;
          const k = argOf(i);
          const note = !live ? "" : i < top ? `waiting for factorial(${k - 1})` : at === n ? "base case: returns 1" : at > n ? `${k} × ${factorialOf(k - 1)} = ${factorialOf(k)}` : "running";
          return (
            <g key={i}>
              <rect x="60" y={y} width="320" height={height} className={live ? (i === top ? "fig-accent" : "fig-fill") : "fig-ghost"} />
              {live ? (
                <>
                  <text x="72" y={y + 24} className="fig-mono" style={i === top ? { fill: "var(--bg)" } : undefined}>
                    factorial({k})
                  </text>
                  <text x="368" y={y + 23} textAnchor="end" className="fig-small" style={i === top ? { fill: "var(--bg)" } : undefined}>
                    {note}
                  </text>
                </>
              ) : null}
            </g>
          );
        })}
      </svg>
    </Frame>
  );
}

const RATES: { name: string; f: (n: number) => number }[] = [
  { name: "log₂ n", f: (n) => Math.log2(n) },
  { name: "n", f: (n) => n },
  { name: "n log₂ n", f: (n) => n * Math.log2(n) },
  { name: "n²", f: (n) => n * n },
  { name: "2ⁿ", f: (n) => 2 ** n },
];

/** How five kinds of running time grow with the size of the input. */
function GrowthRates(props: Props) {
  const [n, setN] = useState(clamp(Math.round(num(props.n, 8)), 2, 32));
  const top = 1100;
  const gx = (x: number) => 44 + ((x - 1) / 31) * 330;
  const gy = (v: number) => 250 - (Math.min(v, top) / top) * 230;
  const whole = (v: number) => group(Math.round(v));
  return (
    <Frame
      title="How running times grow"
      summary={`For an input of size n = ${n}: log₂ n = ${fmt(Math.round(Math.log2(n) * 10) / 10)} steps, n = ${n}, n log₂ n = ${whole(n * Math.log2(n))}, n² = ${whole(n * n)}, 2ⁿ = ${whole(2 ** n)}. Doubling n adds one step to log₂ n, doubles n, multiplies n² by four, and squares 2ⁿ.`}
      controls={<Slider label="size n" value={n} onChange={setN} min={2} max={32} />}
    >
      <svg viewBox="0 0 440 280" role="img" aria-label={`Curves of log n, n, n log n, n squared and 2 to the n, marked at n = ${n}`}>
        <line x1={gx(1)} x2={gx(32)} y1={gy(0)} y2={gy(0)} className="fig-axis" />
        <line x1={gx(1)} x2={gx(1)} y1={gy(0)} y2={gy(top)} className="fig-axis" />
        {[250, 500, 750, 1000].map((v) => (
          <g key={v}>
            <line x1={gx(1)} x2={gx(32)} y1={gy(v)} y2={gy(v)} className="fig-grid" />
            <text x={gx(1) - 6} y={gy(v) + 4} textAnchor="end" className="fig-small">
              {v}
            </text>
          </g>
        ))}
        {[8, 16, 24, 32].map((x) => (
          <text key={x} x={gx(x)} y={gy(0) + 16} textAnchor="middle" className="fig-small">
            {x}
          </text>
        ))}
        <line x1={gx(n)} x2={gx(n)} y1={gy(0)} y2={gy(top)} className="fig-guide" />
        {RATES.map((rate) => {
          const points: string[] = [];
          let end = 1;
          for (let x = 1; x <= 32; x += 0.25) {
            const v = rate.f(x);
            if (v > top) break;
            points.push(`${gx(x).toFixed(1)},${gy(v).toFixed(1)}`);
            end = x;
          }
          const value = rate.f(n);
          return (
            <g key={rate.name}>
              <polyline points={points.join(" ")} className="fig-line" />
              <text x={Math.min(gx(end) + 5, 392)} y={Math.max(gy(rate.f(end)) + (end >= 32 ? 4 : -4), 14)} className="fig-small">
                {rate.name}
              </text>
              {value <= top ? <circle cx={gx(n)} cy={gy(value)} r="4" className="fig-accent" /> : null}
            </g>
          );
        })}
      </svg>
    </Frame>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <span className="fig-stepper">
      <span className="label">{label}</span>
      <button type="button" className="q-move" aria-label={`Switch ${label}`} aria-pressed={value} onClick={() => onChange(!value)}>
        {value ? "T" : "F"}
      </button>
    </span>
  );
}

const CONNECTIVES: { head: string; name: string; f: (p: boolean, q: boolean) => boolean }[] = [
  { head: "¬P", name: "not P", f: (p) => !p },
  { head: "P∧Q", name: "P and Q", f: (p, q) => p && q },
  { head: "P∨Q", name: "P or Q", f: (p, q) => p || q },
  { head: "P⇒Q", name: "P implies Q", f: (p, q) => !p || q },
  { head: "P⇔Q", name: "P if and only if Q", f: (p, q) => p === q },
];

/** The truth table of the five connectives, with the row for the chosen P and Q picked out. */
function TruthTable(props: Props) {
  const [p, setP] = useState(props.p !== false);
  const [q, setQ] = useState(props.q !== false);
  const word = (v: boolean) => (v ? "true" : "false");
  const note = !p ? "A false P makes “P implies Q” true whatever Q is: the promise was never put to the test." : q ? "P held and Q followed: the promise was kept." : "This is the only row in which “P implies Q” is false: P held and Q did not, so the promise was broken.";
  const rows: [boolean, boolean][] = [
    [true, true],
    [true, false],
    [false, true],
    [false, false],
  ];
  const heads = ["P", "Q", ...CONNECTIVES.map((c) => c.head)];
  return (
    <Frame
      title="Truth table"
      summary={`P is ${word(p)} and Q is ${word(q)}. ${CONNECTIVES.map((c) => `${c.name} is ${word(c.f(p, q))}`).join(". ")}. ${note}`}
      controls={
        <>
          <Toggle label="P" value={p} onChange={setP} />
          <Toggle label="Q" value={q} onChange={setQ} />
        </>
      }
    >
      <svg viewBox="0 0 440 280" role="img" aria-label={`Truth table of not, and, or, implies and if and only if, with the row for P ${word(p)} and Q ${word(q)} marked`}>
        {heads.map((h, j) => (
          <text key={h} x={52 + j * 56} y="36" textAnchor="middle" className="fig-small" style={{ fontSize: 13 }}>
            {h}
          </text>
        ))}
        <line x1="24" x2="416" y1="50" y2="50" className="fig-axis" />
        {rows.map(([a, b], i) => {
          const here = a === p && b === q;
          const cells = [a, b, ...CONNECTIVES.map((c) => c.f(a, b))];
          return (
            <g key={i}>
              {here ? <rect x="24" y={60 + i * 50} width="392" height="40" className="fig-accent" /> : null}
              {cells.map((v, j) => (
                <text key={j} x={52 + j * 56} y={86 + i * 50} textAnchor="middle" className="fig-mono" style={here ? { fill: "var(--bg)" } : undefined}>
                  {v ? "T" : "F"}
                </text>
              ))}
            </g>
          );
        })}
      </svg>
    </Frame>
  );
}

/** Induction as a row of dominoes: a first push and a rule that each knocks over the next. */
function Dominoes(props: Props) {
  const count = 8;
  const [base, setBase] = useState(props.base !== false);
  const [gap, setGap] = useState(clamp(Math.round(num(props.gap, 0)), 0, count - 1));
  const fallen = !base ? 0 : gap === 0 ? count : gap;
  const summary = !base
    ? `The base case P(1) has not been shown. ${gap === 0 ? "Every step from P(k) to P(k + 1) holds, and yet" : "So"} no domino falls: nothing starts the chain.`
    : gap === 0
      ? `The base case P(1) holds, and every step from P(k) to P(k + 1) holds. All ${count} dominoes fall, and so would any number of them: P(n) is true for every n.`
      : `The base case P(1) holds, but the step from P(${gap}) to P(${gap + 1}) fails. ${gap === 1 ? "Domino 1 falls" : `Dominoes 1 to ${gap} fall`} and the rest stand: nothing is proved beyond the gap.`;
  return (
    <Frame
      title="Induction as falling dominoes"
      summary={summary}
      controls={
        <>
          <Toggle label="base case" value={base} onChange={setBase} />
          <Stepper label="broken step" value={gap} onChange={setGap} min={0} max={count - 1} />
        </>
      }
    >
      <svg viewBox="0 0 440 280" role="img" aria-label={`${count} dominoes in a row, ${fallen} of them fallen`}>
        <line x1="20" x2="420" y1="230" y2="230" className="fig-axis" />
        {Array.from({ length: count }, (_, i) => {
          const x = 40 + i * 48;
          const down = i < fallen;
          return (
            <g key={i}>
              {down ? <rect x={x} y="216" width="42" height="14" className="fig-accent" /> : <rect x={x} y="120" width="14" height="110" className="fig-fill" />}
              <text x={x + 7} y="254" textAnchor="middle" className="fig-small">
                P({i + 1})
              </text>
              {base && gap === i + 1 ? (
                <text x={x + 21} y="208" textAnchor="middle" className="fig-small">
                  gap
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </Frame>
  );
}

const BIT_LISTS = [
  ["010101", "111111", "000000", "100100", "001101", "110010"],
  ["000000", "100000", "010000", "110000", "001000", "101000"],
  ["101010", "011011", "110110", "000111", "111000", "010010"],
];

/** Cantor's diagonal argument: flip the diagonal of any list of bit sequences to build one the list missed. */
function Diagonal(props: Props) {
  const [list, setList] = useState(clamp(Math.round(num(props.list, 1)), 1, BIT_LISTS.length));
  const [k, setK] = useState(clamp(Math.round(num(props.k, 1)), 1, 6));
  const rows = BIT_LISTS[list - 1];
  const flipped = rows.map((row, i) => (row[i] === "0" ? "1" : "0"));
  const soFar = flipped.slice(0, k).join("");
  return (
    <Frame
      title="The diagonal argument"
      summary={`Row ${k} has ${rows[k - 1][k - 1]} in place ${k}, so the new sequence gets ${flipped[k - 1]} there. So far the new sequence starts ${soFar}. It differs from ${k === 1 ? "row 1" : `each of rows 1 to ${k}`} in at least one place${k === 6 ? ", and continuing in the same way it differs from every row of the list, however long the list is. The list has missed it." : "."}`}
      controls={
        <>
          <Stepper label="row" value={k} onChange={setK} min={1} max={6} />
          <Stepper
            label="list"
            value={list}
            onChange={(v) => {
              setList(v);
              setK(1);
            }}
            min={1}
            max={BIT_LISTS.length}
          />
        </>
      }
    >
      <svg viewBox="0 0 440 280" role="img" aria-label={`A list of six sequences of bits with the first ${k} diagonal entries marked, and a new sequence that starts ${soFar}`}>
        {rows.map((row, i) => (
          <g key={i}>
            <text x="60" y={36 + i * 32} textAnchor="end" className="fig-small">
              row {i + 1}
            </text>
            {row.split("").map((bit, j) => {
              const marked = i === j && i < k;
              return (
                <g key={j}>
                  {marked ? <rect x={82 + j * 40} y={16 + i * 32} width="28" height="28" className="fig-fill" /> : null}
                  <text x={96 + j * 40} y={37 + i * 32} textAnchor="middle" className="fig-mono">
                    {bit}
                  </text>
                </g>
              );
            })}
            <text x={96 + 6 * 40} y={37 + i * 32} textAnchor="middle" className="fig-small">
              …
            </text>
          </g>
        ))}
        <line x1="20" x2="420" y1="214" y2="214" className="fig-axis" />
        <text x="60" y="246" textAnchor="end" className="fig-small">
          new
        </text>
        {flipped.map((bit, j) =>
          j < k ? (
            <g key={j}>
              <rect x={82 + j * 40} y="226" width="28" height="28" className="fig-accent" />
              <text x={96 + j * 40} y="247" textAnchor="middle" className="fig-mono" style={{ fill: "var(--bg)" }}>
                {bit}
              </text>
            </g>
          ) : null,
        )}
      </svg>
    </Frame>
  );
}

/** The terms of a convergent sequence and a band of tolerance about its limit: from some N onwards every term is inside. */
function EpsilonBand(props: Props) {
  const [hundredths, setHundredths] = useState(clamp(Math.round(num(props.tolerance, 0.2) * 20) * 5, 5, 50));
  const eps = hundredths / 100;
  const outside = Math.floor(100 / hundredths); // terms with 1/n >= eps
  const from = outside + 1;
  const gx = (n: number) => 44 + ((n - 1) / 29) * 380;
  const gy = (v: number) => 250 - (v / 2) * 230;
  return (
    <Frame
      title="A tolerance and the point where the terms stay inside it"
      summary={`The sequence aₙ = 1 + (−1)ⁿ ÷ n has the limit 1. For the tolerance ε = ${fmt(eps)}, every term from N = ${from} onwards is within ${fmt(eps)} of 1. The first ${outside} term${outside === 1 ? " is" : "s are"} not. A smaller ε needs a larger N, but some N always works.`}
      controls={<Slider label="tolerance in hundredths" value={hundredths} onChange={setHundredths} min={5} max={50} step={5} />}
    >
      <svg viewBox="0 0 440 280" role="img" aria-label={`The first 30 terms of a sequence with limit 1, a band of half-width ${fmt(eps)} about 1, and a line at N = ${from}`}>
        <rect x={gx(1)} y={gy(1 + eps)} width={gx(30) - gx(1)} height={gy(1 - eps) - gy(1 + eps)} className="fig-fill" opacity="0.45" />
        <line x1={gx(1)} x2={gx(30)} y1={gy(0)} y2={gy(0)} className="fig-axis" />
        <line x1={gx(1)} x2={gx(30)} y1={gy(1)} y2={gy(1)} className="fig-guide" />
        <text x={gx(1) - 14} y={gy(1) + 4} textAnchor="end" className="fig-small">
          1
        </text>
        <text x={gx(1) - 14} y={gy(0) + 4} textAnchor="end" className="fig-small">
          0
        </text>
        <text x={gx(1) - 14} y={gy(2) + 4} textAnchor="end" className="fig-small">
          2
        </text>
        {from <= 30 ? (
          <>
            <line x1={gx(from)} x2={gx(from)} y1={gy(0)} y2={gy(2)} className="fig-guide" />
            <text x={gx(from)} y={gy(0) + 16} textAnchor="middle" className="fig-small">
              N = {from}
            </text>
          </>
        ) : null}
        {Array.from({ length: 30 }, (_, i) => {
          const n = i + 1;
          const v = 1 + (n % 2 === 0 ? 1 : -1) / n;
          return <circle key={n} cx={gx(n)} cy={gy(v)} r="4" className={n >= from ? "fig-accent" : "fig-line"} />;
        })}
      </svg>
    </Frame>
  );
}

/** The whole numbers sorted into classes by their remainder: an equivalence relation seen as a partition. */
function RemainderClasses(props: Props) {
  const [m, setM] = useState(clamp(Math.round(num(props.modulus, 3)), 2, 6));
  const [pick, setPick] = useState(clamp(Math.round(num(props.number, 14)), 0, 17));
  const r = pick % m;
  const mates = Array.from({ length: 18 }, (_, k) => k).filter((k) => k % m === r);
  const width = 380 / m;
  return (
    <Frame
      title="Classes of whole numbers with the same remainder"
      summary={`Call two numbers related when their difference is a multiple of ${m}. The numbers fall into ${m} classes, one for each remainder, and every number is in exactly one class. ${pick} leaves the remainder ${r}, and its class is shown: ${mates.join(", ")}, and so on.`}
      controls={
        <>
          <Stepper label="modulus" value={m} onChange={setM} min={2} max={6} />
          <Stepper label="number" value={pick} onChange={setPick} min={0} max={17} />
        </>
      }
    >
      <svg viewBox="0 0 440 280" role="img" aria-label={`The numbers 0 to 17 in ${m} columns by remainder on division by ${m}, with the class of ${pick} marked`}>
        {Array.from({ length: m }, (_, c) => (
          <g key={c}>
            {c === r ? <rect x={30 + c * width + 4} y="34" width={width - 8} height="240" className="fig-fill" opacity="0.45" /> : <rect x={30 + c * width + 4} y="34" width={width - 8} height="240" className="fig-ghost" />}
            <text x={30 + c * width + width / 2} y="24" textAnchor="middle" className="fig-small">
              remainder {c}
            </text>
          </g>
        ))}
        {Array.from({ length: 18 }, (_, k) => {
          const x = 30 + (k % m) * width + width / 2;
          const y = 58 + Math.floor(k / m) * 25;
          return (
            <g key={k}>
              {k === pick ? <rect x={x - 16} y={y - 17} width="32" height="23" className="fig-accent" /> : null}
              <text x={x} y={y} textAnchor="middle" className="fig-mono" style={k === pick ? { fill: "var(--bg)", fontSize: 15 } : { fontSize: 15 }}>
                {k}
              </text>
            </g>
          );
        })}
      </svg>
    </Frame>
  );
}

const KEY_PATTERNS: { name: string; opens: (lock: number, key: number) => boolean }[] = [
  { name: "one key for each lock", opens: (l, k) => l === k },
  { name: "a master key", opens: (l, k) => l === k || k === 1 },
  { name: "a lock with no key", opens: (l, k) => l === k && l !== 2 },
  { name: "no key opens anything", opens: () => false },
  { name: "every key opens every lock", opens: () => true },
];

/** A grid of which key opens which lock: "for every … there is" reads along rows, "there is … for every" down a column. */
function QuantifierGrid(props: Props) {
  const [pattern, setPattern] = useState(clamp(Math.round(num(props.pattern, 1)), 1, KEY_PATTERNS.length));
  const { name, opens } = KEY_PATTERNS[pattern - 1];
  const four = [0, 1, 2, 3];
  const bareRow = four.find((l) => !four.some((k) => opens(l, k)));
  const fullColumn = four.find((k) => four.every((l) => opens(l, k)));
  const each = bareRow === undefined;
  const master = fullColumn !== undefined;
  return (
    <Frame
      title="Which key opens which lock"
      summary={`Pattern ${pattern}, ${name}. “For every lock there is a key that opens it” is ${each ? "true: every row has a mark" : `false: the row of lock ${bareRow + 1} has no mark`}. “There is a key that opens every lock” is ${master ? `true: the column of key ${fullColumn + 1} is full` : "false: no column is full"}.`}
      controls={<Stepper label="pattern" value={pattern} onChange={setPattern} min={1} max={KEY_PATTERNS.length} />}
    >
      <svg viewBox="0 0 440 280" role="img" aria-label={`A grid of four locks against four keys for the pattern ${name}`}>
        {four.map((k) => (
          <text key={k} x={150 + k * 60} y="34" textAnchor="middle" className="fig-small">
            key {k + 1}
          </text>
        ))}
        {four.map((l) => (
          <g key={l}>
            <text x="104" y={76 + l * 54} textAnchor="end" className="fig-small">
              lock {l + 1}
            </text>
            {four.map((k) => (
              <g key={k}>
                <rect x={126 + k * 60} y={48 + l * 54} width="48" height="44" className={opens(l, k) ? (k === fullColumn ? "fig-accent" : "fig-fill") : "fig-ghost"} />
                {opens(l, k) ? (
                  <text x={150 + k * 60} y={77 + l * 54} textAnchor="middle" className="fig-mono" style={k === fullColumn ? { fill: "var(--bg)" } : undefined}>
                    ✓
                  </text>
                ) : null}
              </g>
            ))}
          </g>
        ))}
      </svg>
    </Frame>
  );
}

/* Calculus figures share one small plotting kit: a window on the plane, mapped to a 440 by 280 drawing. */
type View = { x0: number; x1: number; y0: number; y1: number };
const dp = (n: number, places = 4) => {
  const scale = 10 ** places;
  const rounded = Math.round(n * scale) / scale;
  return String(rounded === 0 ? 0 : rounded).replace("-", "−");
};
const scales = (v: View) => ({
  sx: (x: number) => 40 + ((x - v.x0) / (v.x1 - v.x0)) * 380,
  sy: (y: number) => 260 - ((clamp(y, v.y0 - (v.y1 - v.y0), v.y1 + (v.y1 - v.y0)) - v.y0) / (v.y1 - v.y0)) * 240,
});
const curvePoints = (f: (x: number) => number, v: View, from = v.x0, to = v.x1) => {
  const { sx, sy } = scales(v);
  return Array.from({ length: 121 }, (_, i) => {
    const x = from + ((to - from) * i) / 120;
    return `${sx(x).toFixed(1)},${sy(f(x)).toFixed(1)}`;
  }).join(" ");
};
function Axes({ view }: { view: View }) {
  const { sx, sy } = scales(view);
  const ax = clamp(0, view.x0, view.x1);
  const ay = clamp(0, view.y0, view.y1);
  return (
    <>
      <line x1={sx(view.x0)} x2={sx(view.x1)} y1={sy(ay)} y2={sy(ay)} className="fig-axis" />
      <line x1={sx(ax)} x2={sx(ax)} y1={sy(view.y0)} y2={sy(view.y1)} className="fig-axis" />
      <text x={sx(view.x0)} y={sy(ay) + 14} className="fig-small">
        {fmt(view.x0)}
      </text>
      <text x={sx(view.x1)} y={sy(ay) + 14} textAnchor="end" className="fig-small">
        {fmt(view.x1)}
      </text>
      <text x={sx(ax) - 6} y={sy(view.y1) + 10} textAnchor="end" className="fig-small">
        {fmt(view.y1)}
      </text>
    </>
  );
}

const APPROACH = [1, 0.5, 0.1, 0.01, 0.001];
const LIMIT_CASES: Record<string, { name: string; at: number; f: (x: number) => number; view: View; limit: number | null; atPoint: string }> = {
  hole: {
    name: "f(x) = (x² − 1) ÷ (x − 1)",
    at: 1,
    f: (x) => (x * x - 1) / (x - 1),
    view: { x0: -1, x1: 3, y0: 0, y1: 4 },
    limit: 2,
    atPoint: "At x = 1 itself the formula says 0 ÷ 0 and has no value.",
  },
  sinc: {
    name: "f(x) = sin x ÷ x",
    at: 0,
    f: (x) => Math.sin(x) / x,
    view: { x0: -4, x1: 4, y0: -0.5, y1: 1.5 },
    limit: 1,
    atPoint: "At x = 0 itself the formula says 0 ÷ 0 and has no value.",
  },
  jump: {
    name: "f(x) = 1 for x < 2 and 3 for x ≥ 2",
    at: 2,
    f: (x) => (x < 2 ? 1 : 3),
    view: { x0: 0, x1: 4, y0: 0, y1: 4 },
    limit: null,
    atPoint: "At x = 2 itself the value is 3.",
  },
};

/** Values of a function on both sides of a point, taken closer and closer, with the point itself left out. */
function LimitApproach(props: Props) {
  const which = typeof props.fn === "string" && props.fn in LIMIT_CASES ? props.fn : "hole";
  const c = LIMIT_CASES[which];
  const [k, setK] = useState(clamp(Math.round(num(props.closeness, 1)), 0, 4));
  const d = APPROACH[k];
  const { sx, sy } = scales(c.view);
  const left = c.f(c.at - d);
  const right = c.f(c.at + d);
  return (
    <Frame
      title="Approaching a point from both sides"
      summary={`${c.name}. At x = ${dp(c.at - d)} it is ${dp(left)} and at x = ${dp(c.at + d)} it is ${dp(right)}. ${c.atPoint} ${
        c.limit === null
          ? `From the left the values stay at ${dp(left)} and from the right at ${dp(right)}. They do not close in on one number, so there is no limit at ${c.at}.`
          : `The nearer x is to ${c.at}, the nearer f(x) is to ${c.limit}: the limit is ${c.limit}.`
      }`}
      controls={<Stepper label="closeness" value={k} onChange={setK} min={0} max={4} />}
    >
      <svg viewBox="0 0 440 280" role="img" aria-label={`Graph of ${c.name} near x = ${c.at}, with points at distance ${d} on each side`}>
        <Axes view={c.view} />
        <polyline points={curvePoints(c.f, c.view, c.view.x0, c.at - 0.0001)} className="fig-line" />
        <polyline points={curvePoints(c.f, c.view, c.at + 0.0001, c.view.x1)} className="fig-line" />
        <line x1={sx(c.at)} x2={sx(c.at)} y1={sy(c.view.y0)} y2={sy(c.view.y1)} className="fig-guide" />
        {c.limit === null ? null : <circle cx={sx(c.at)} cy={sy(c.limit)} r="5" className="fig-ghost" style={{ fill: "var(--bg)", stroke: "var(--text-secondary)" }} />}
        <circle cx={sx(c.at - d)} cy={sy(left)} r="5" className="fig-accent" />
        <circle cx={sx(c.at + d)} cy={sy(right)} r="5" className="fig-accent" />
      </svg>
    </Frame>
  );
}

const CURVES: Record<string, { name: string; f: (x: number) => number; d: (x: number) => number; view: View; low: number; high: number }> = {
  square: { name: "x²", f: (x) => x * x, d: (x) => 2 * x, view: { x0: -3, x1: 3, y0: -1, y1: 9 }, low: -2, high: 2 },
  cube: { name: "x³", f: (x) => x ** 3, d: (x) => 3 * x * x, view: { x0: -2, x1: 2, y0: -8, y1: 8 }, low: -1.5, high: 1 },
  recip: { name: "1 ÷ x", f: (x) => 1 / x, d: (x) => -1 / (x * x), view: { x0: 0.2, x1: 4, y0: 0, y1: 5 }, low: 0.5, high: 3 },
  sin: { name: "sin x", f: Math.sin, d: Math.cos, view: { x0: -1, x1: 7, y0: -1.5, y1: 1.5 }, low: 0, high: 6 },
  exp: { name: "eˣ", f: Math.exp, d: Math.exp, view: { x0: -2, x1: 2.5, y0: -0.5, y1: 8 }, low: -1.5, high: 1 },
  ln: { name: "ln x", f: Math.log, d: (x) => 1 / x, view: { x0: 0.2, x1: 6, y0: -2, y1: 2.5 }, low: 0.5, high: 5 },
};

/** A chord of a curve whose second end slides towards the first, so that its slope closes in on the slope of the tangent. */
function Secant(props: Props) {
  const which = typeof props.fn === "string" && props.fn in CURVES ? props.fn : "square";
  const c = CURVES[which];
  const [a, setA] = useState(clamp(num(props.at, 1), c.low, c.high));
  const [k, setK] = useState(clamp(Math.round(num(props.closeness, 0)), 0, 4));
  const h = APPROACH[k];
  const rise = c.f(a + h) - c.f(a);
  const chord = rise / h;
  const slope = c.d(a);
  const { sx, sy } = scales(c.view);
  const through = (m: number) => (x: number) => c.f(a) + m * (x - a);
  return (
    <Frame
      title="From a chord to a tangent"
      summary={`f(x) = ${c.name}. From x = ${dp(a)} to x = ${dp(a + h)} the curve ${rise >= 0 ? "rises" : "falls"} ${dp(Math.abs(rise))} over a run of ${dp(h)}, so the chord has slope ${dp(chord)}. The tangent at x = ${dp(a)} has slope ${dp(slope)}. Shrinking the run brings the chord's slope as near to that as you like.`}
      controls={
        <>
          <Slider label="point a" value={a} onChange={setA} min={c.low} max={c.high} step={0.25} />
          <Stepper label="closeness" value={k} onChange={setK} min={0} max={4} />
        </>
      }
    >
      <svg viewBox="0 0 440 280" role="img" aria-label={`The curve y = ${c.name} with a chord from x = ${dp(a)} to x = ${dp(a + h)} and the tangent at x = ${dp(a)}`}>
        <Axes view={c.view} />
        <polyline points={curvePoints(c.f, c.view)} className="fig-line" />
        <polyline points={curvePoints(through(slope), c.view)} className="fig-guide" fill="none" />
        <polyline points={curvePoints(through(chord), c.view)} className="fig-accent-line" fill="none" style={{ strokeWidth: 2 }} />
        <circle cx={sx(a)} cy={sy(c.f(a))} r="5" className="fig-accent" />
        <circle cx={sx(a + h)} cy={sy(c.f(a + h))} r="5" className="fig-accent" />
      </svg>
    </Frame>
  );
}

/** Two machines in a row. Each multiplies small changes by its own local rate, and the rates multiply. */
function ChainRates(props: Props) {
  const [tenths, setTenths] = useState(clamp(Math.round(num(props.x, 1.2) * 10), 5, 20));
  const x = tenths / 10;
  const u = x * x;
  const y = u ** 3;
  const inner = 2 * x;
  const outer = 3 * u * u;
  const box = (cx: number, label: string, value: string) => (
    <g>
      <rect x={cx - 52} y="70" width="104" height="70" className="fig-cell" />
      <text x={cx} y="98" textAnchor="middle" className="fig-small">
        {label}
      </text>
      <text x={cx} y="124" textAnchor="middle" className="fig-mono">
        {value}
      </text>
    </g>
  );
  const arrow = (x1: number, x2: number, yy: number, text: string) => (
    <g>
      <line x1={x1} x2={x2} y1={yy} y2={yy} className="fig-accent-line" style={{ strokeWidth: 2 }} />
      <polygon points={`${x2},${yy} ${x2 - 9},${yy - 5} ${x2 - 9},${yy + 5}`} className="fig-accent" />
      <text x={(x1 + x2) / 2} y={yy - 9} textAnchor="middle" className="fig-small">
        {text}
      </text>
    </g>
  );
  return (
    <Frame
      title="Rates multiply along a chain"
      summary={`u = x² and y = u³. At x = ${dp(x)}: u = ${dp(u)} and y = ${dp(y)}. A small change in x is multiplied by ${dp(inner)} on its way to u, and a small change in u is multiplied by ${dp(outer)} on its way to y. So y changes ${dp(inner)} × ${dp(outer)} = ${dp(inner * outer)} times as fast as x.`}
      controls={<Slider label="x in tenths" value={tenths} onChange={setTenths} min={5} max={20} />}
    >
      <svg viewBox="0 0 440 220" role="img" aria-label={`Three boxes for x, u and y joined by arrows carrying the rates ${dp(inner)} and ${dp(outer)}`}>
        {box(70, "x", dp(x))}
        {box(220, "u = x²", dp(u))}
        {box(370, "y = u³", dp(y))}
        {arrow(124, 166, 105, `× ${dp(inner, 2)}`)}
        {arrow(274, 316, 105, `× ${dp(outer, 2)}`)}
        {arrow(70, 370, 180, `altogether × ${dp(inner * outer, 2)}`)}
        <line x1="70" x2="70" y1="140" y2="180" className="fig-guide" />
      </svg>
    </Frame>
  );
}

/** A curve with its tangent, read for height, slope and bending at one point. */
function Bend(props: Props) {
  const view: View = { x0: -2.5, x1: 2.5, y0: -5, y1: 5 };
  const f = (x: number) => x ** 3 - 3 * x;
  const [a, setA] = useState(clamp(num(props.at, 1), -2, 2));
  const slope = 3 * a * a - 3;
  const second = 6 * a;
  const { sx, sy } = scales(view);
  const bending =
    second > 0
      ? "The slope is increasing, so the curve bends upwards and lies above its tangent near here."
      : second < 0
        ? "The slope is decreasing, so the curve bends downwards and lies below its tangent near here."
        : "The bending changes direction here. This is a point of inflection, and the curve crosses its tangent.";
  const flat = slope !== 0 ? "" : second > 0 ? " With slope 0 and upward bending, this is a local minimum." : " With slope 0 and downward bending, this is a local maximum.";
  return (
    <Frame
      title="Slope and bending"
      summary={`f(x) = x³ − 3x at x = ${dp(a)}: height ${dp(f(a))}, slope f′ = ${dp(slope)}, second derivative f″ = ${dp(second)}. ${bending}${flat}`}
      controls={<Slider label="point a" value={a} onChange={setA} min={-2} max={2} step={0.25} />}
    >
      <svg viewBox="0 0 440 280" role="img" aria-label={`The curve y = x³ − 3x with its tangent at x = ${dp(a)}`}>
        <Axes view={view} />
        <polyline points={curvePoints(f, view)} className="fig-line" />
        <polyline points={curvePoints((x) => f(a) + slope * (x - a), view, a - 1, a + 1)} className="fig-accent-line" fill="none" style={{ strokeWidth: 2 }} />
        <circle cx={sx(a)} cy={sy(f(a))} r="5" className="fig-accent" />
      </svg>
    </Frame>
  );
}

const factorials = [1, 1, 2, 6, 24, 120, 720, 5040, 40320, 362880];
const SERIES: Record<string, { name: string; f: (x: number) => number; coeff: (k: number) => number; view: View; low: number; high: number; note: string }> = {
  sin: { name: "sin x", f: Math.sin, coeff: (k) => (k % 2 === 0 ? 0 : (k % 4 === 1 ? 1 : -1) / factorials[k]), view: { x0: -7, x1: 7, y0: -2.5, y1: 2.5 }, low: -6, high: 6, note: "" },
  cos: { name: "cos x", f: Math.cos, coeff: (k) => (k % 2 === 1 ? 0 : (k % 4 === 0 ? 1 : -1) / factorials[k]), view: { x0: -7, x1: 7, y0: -2.5, y1: 2.5 }, low: -6, high: 6, note: "" },
  exp: { name: "eˣ", f: Math.exp, coeff: (k) => 1 / factorials[k], view: { x0: -3, x1: 3, y0: -1, y1: 10 }, low: -3, high: 3, note: "" },
  ln: {
    name: "ln(1 + x)",
    f: (x) => Math.log(1 + x),
    coeff: (k) => (k === 0 ? 0 : (k % 2 === 1 ? 1 : -1) / k),
    view: { x0: -0.9, x1: 2.5, y0: -2.5, y1: 2.5 },
    low: -0.75,
    high: 2.25,
    note: " For this function the polynomials only help between −1 and 1. Beyond 1, raising the degree makes them worse.",
  },
};

/** A function and its Taylor polynomial about 0, degree by degree. */
function Taylor(props: Props) {
  const which = typeof props.fn === "string" && props.fn in SERIES ? props.fn : "sin";
  const s = SERIES[which];
  const [degree, setDegree] = useState(clamp(Math.round(num(props.degree, 1)), 0, 9));
  const [x, setX] = useState(clamp(num(props.x, 2), s.low, s.high));
  const poly = (t: number) => {
    let total = 0;
    for (let k = degree; k >= 0; k--) total = total * t + s.coeff(k);
    return total;
  };
  const { sx, sy } = scales(s.view);
  return (
    <Frame
      title="Taylor polynomials"
      summary={`The polynomial of degree ${degree} for ${s.name} about 0. At x = ${dp(x)} it gives ${dp(poly(x))}, and the function itself is ${dp(s.f(x))}: the error is ${dp(Math.abs(poly(x) - s.f(x)))}. Near 0 the two agree closely, and a higher degree keeps them together further out.${s.note}`}
      controls={
        <>
          <Stepper label="degree" value={degree} onChange={setDegree} min={0} max={9} />
          <Slider label="x" value={x} onChange={setX} min={s.low} max={s.high} step={0.25} />
        </>
      }
    >
      <svg viewBox="0 0 440 280" role="img" aria-label={`The graph of ${s.name} and its Taylor polynomial of degree ${degree}`}>
        <Axes view={s.view} />
        <polyline points={curvePoints(s.f, s.view)} className="fig-line" />
        <polyline points={curvePoints(poly, s.view)} className="fig-accent-line" fill="none" style={{ strokeWidth: 2 }} />
        <line x1={sx(x)} x2={sx(x)} y1={sy(s.f(x))} y2={sy(poly(x))} className="fig-guide" />
        <circle cx={sx(x)} cy={sy(s.f(x))} r="4" className="fig-line" />
        <circle cx={sx(x)} cy={sy(poly(x))} r="4" className="fig-accent" />
      </svg>
    </Frame>
  );
}

/** Gradient descent on f(x) = x²: step against the slope, with a step size that helps or ruins it. */
function Descent(props: Props) {
  const view: View = { x0: -4, x1: 4, y0: 0, y1: 16 };
  const [hundredths, setHundredths] = useState(clamp(Math.round(num(props.rate, 0.1) * 20) * 5, 5, 110));
  const [steps, setSteps] = useState(clamp(Math.round(num(props.steps, 5)), 0, 12));
  const rate = hundredths / 100;
  const factor = 1 - 2 * rate;
  const xs = Array.from({ length: steps + 1 }, (_, i) => 3 * factor ** i);
  const last = xs[steps];
  const { sx, sy } = scales(view);
  const verdict =
    rate === 0.5
      ? "The factor is 0, so one step lands exactly on the minimum."
      : rate === 1
        ? "The factor is −1, so x jumps between 3 and −3 for ever and never improves."
        : Math.abs(factor) < 1
          ? `The distance from the minimum is multiplied by ${dp(Math.abs(factor))} at each step, so the steps close in on 0${factor < 0 ? ", jumping from side to side" : ""}.`
          : `Each step overshoots and lands further away than it started: the distance is multiplied by ${dp(Math.abs(factor))}. The method diverges.`;
  return (
    <Frame
      title="Stepping downhill"
      summary={`f(x) = x², starting at x = 3, with step size ${dp(rate)}. Each step replaces x by x − ${dp(rate)} × 2x, which is ${dp(factor)} times x. After ${steps} step${steps === 1 ? "" : "s"}, x = ${dp(last)} and f(x) = ${dp(last * last)}. ${verdict}`}
      controls={
        <>
          <Slider label="step size in hundredths" value={hundredths} onChange={setHundredths} min={5} max={110} step={5} />
          <Stepper label="steps" value={steps} onChange={setSteps} min={0} max={12} />
        </>
      }
    >
      <svg viewBox="0 0 440 280" role="img" aria-label={`A parabola with ${steps + 1} points marking the steps of gradient descent with step size ${dp(rate)}`}>
        <Axes view={view} />
        <polyline points={curvePoints((t) => t * t, view)} className="fig-line" />
        <polyline points={xs.map((t) => `${sx(clamp(t, -4, 4)).toFixed(1)},${sy(Math.min(t * t, 16)).toFixed(1)}`).join(" ")} className="fig-guide" fill="none" />
        {xs.map((t, i) => (Math.abs(t) <= 4 ? <circle key={i} cx={sx(t)} cy={sy(t * t)} r={i === steps ? 5 : 3} className={i === steps ? "fig-accent" : "fig-line"} /> : null))}
      </svg>
    </Frame>
  );
}

const AREAS: Record<string, { name: string; f: (x: number) => number; a: number; b: number; bName: string; exact: number; view: View }> = {
  square: { name: "y = x²", f: (x) => x * x, a: 0, b: 3, bName: "3", exact: 9, view: { x0: 0, x1: 3.2, y0: 0, y1: 9.5 } },
  line: { name: "y = 2x + 1", f: (x) => 2 * x + 1, a: 0, b: 3, bName: "3", exact: 12, view: { x0: 0, x1: 3.2, y0: 0, y1: 7.5 } },
  sin: { name: "y = sin x", f: Math.sin, a: 0, b: Math.PI, bName: "π", exact: 2, view: { x0: 0, x1: 3.3, y0: 0, y1: 1.3 } },
  recip: { name: "y = 1 ÷ x", f: (x) => 1 / x, a: 1, b: Math.E, bName: "e", exact: 1, view: { x0: 0.8, x1: 2.9, y0: 0, y1: 1.2 } },
};
const RULES = ["left ends", "midpoints", "right ends"];

/** The area under a curve as a sum of rectangles, which improves as the rectangles are made narrower. */
function Riemann(props: Props) {
  const which = typeof props.fn === "string" && props.fn in AREAS ? props.fn : "square";
  const c = AREAS[which];
  const [doublings, setDoublings] = useState(clamp(Math.round(num(props.doublings, 2)), 0, 6));
  const [rule, setRule] = useState(clamp(Math.round(num(props.rule, 0)), 0, 2));
  const n = 2 ** doublings;
  const width = (c.b - c.a) / n;
  const heights = Array.from({ length: n }, (_, i) => c.f(c.a + (i + rule / 2) * width));
  const total = heights.reduce((sum, hgt) => sum + hgt * width, 0);
  const { sx, sy } = scales(c.view);
  return (
    <Frame
      title="Area as a sum of rectangles"
      summary={`${n} rectangle${n === 1 ? "" : "s"} under ${c.name} from ${c.a} to ${c.bName}, with heights taken at the ${RULES[rule]}, total ${dp(total)}. The exact area is ${dp(c.exact)}. The error is ${dp(Math.abs(total - c.exact))}. Doubling the number of rectangles shrinks the error.`}
      controls={
        <>
          <Stepper label="doublings" value={doublings} onChange={setDoublings} min={0} max={6} />
          <button type="button" className="btn btn-secondary btn-small" aria-label="Change rule" onClick={() => setRule((rule + 1) % 3)}>
            Heights at {RULES[rule]}
          </button>
        </>
      }
    >
      <svg viewBox="0 0 440 280" role="img" aria-label={`${n} rectangles under the curve ${c.name}`}>
        {heights.map((hgt, i) => (
          <rect key={i} x={sx(c.a + i * width)} y={sy(hgt)} width={Math.max(0.5, sx(c.a + (i + 1) * width) - sx(c.a + i * width) - (n > 16 ? 0 : 1))} height={sy(0) - sy(hgt)} className="fig-fill" />
        ))}
        <Axes view={c.view} />
        <polyline points={curvePoints(c.f, c.view, c.a, c.b)} className="fig-accent-line" fill="none" style={{ strokeWidth: 2 }} />
      </svg>
    </Frame>
  );
}

/** The area gathered under a rate, and the fact that it grows at exactly that rate. */
function Accumulation(props: Props) {
  const rate = (t: number) => 3 - t;
  const area = (t: number) => 3 * t - (t * t) / 2;
  const [quarters, setQuarters] = useState(clamp(Math.round(num(props.x, 2) * 4), 0, 20));
  const x = quarters / 4;
  const top: View = { x0: 0, x1: 5, y0: -2.5, y1: 3.5 };
  const sx = (t: number) => 40 + (t / 5) * 380;
  const syTop = (v: number) => 130 - ((v - top.y0) / (top.y1 - top.y0)) * 120;
  const syBottom = (v: number) => 270 - (v / 5) * 110;
  const state =
    x < 3
      ? "The rate is positive, so the total is rising."
      : x === 3
        ? "The rate is zero, so the total has stopped rising: it is at its greatest, 4.5."
        : "The rate is negative. Area below the axis is subtracted, so the total is falling.";
  const line = (pts: [number, number][], sy: (v: number) => number) => pts.map(([t, v]) => `${sx(t).toFixed(1)},${sy(v).toFixed(1)}`).join(" ");
  return (
    <Frame
      title="A total and its rate"
      summary={`The rate is f(t) = 3 − t. The area gathered from 0 to x = ${dp(x)} is A(x) = ${dp(area(x))}. At this moment A is changing at the rate f(${dp(x)}) = ${dp(rate(x))}. ${state}`}
      controls={<Slider label="x in quarters" value={quarters} onChange={setQuarters} min={0} max={20} />}
    >
      <svg viewBox="0 0 440 280" role="img" aria-label={`Above, the line f(t) = 3 − t with the area from 0 to ${dp(x)} shaded. Below, the graph of the area gathered so far.`}>
        <polygon points={line(x <= 3 ? [[0, 0], [0, 3], [x, rate(x)], [x, 0]] : [[0, 0], [0, 3], [3, 0]], syTop)} className="fig-fill" />
        {x > 3 ? <polygon points={line([[3, 0], [x, rate(x)], [x, 0]], syTop)} className="fig-fill" opacity="0.45" /> : null}
        <line x1={sx(0)} x2={sx(5)} y1={syTop(0)} y2={syTop(0)} className="fig-axis" />
        <polyline points={line([[0, 3], [5, -2]], syTop)} className="fig-line" />
        <circle cx={sx(x)} cy={syTop(rate(x))} r="4" className="fig-accent" />
        <text x={sx(5)} y={syTop(0) - 6} textAnchor="end" className="fig-small">
          rate f(t)
        </text>
        <line x1={sx(0)} x2={sx(5)} y1={syBottom(0)} y2={syBottom(0)} className="fig-axis" />
        <polyline points={line(Array.from({ length: 41 }, (_, i) => [i / 8, area(i / 8)] as [number, number]), syBottom)} className="fig-line" />
        <line x1={sx(x)} x2={sx(x)} y1={syTop(top.y1)} y2={syBottom(0)} className="fig-guide" />
        <circle cx={sx(x)} cy={syBottom(area(x))} r="5" className="fig-accent" />
        <text x={sx(5)} y={syBottom(0) - 6} textAnchor="end" className="fig-small">
          total A(x)
        </text>
      </svg>
    </Frame>
  );
}

/* Vectors are drawn on a square grid, 40 pixels to the unit in both directions, so that angles and lengths look true. */
const gx = (x: number) => 230 + 40 * x;
const gy = (y: number) => 140 - 40 * y;
type Pair = [number, number];
const pair = ([x, y]: Pair) => `(${dp(x)}, ${dp(y)})`;
const dot = (a: Pair, b: Pair) => a[0] * b[0] + a[1] * b[1];
const signed = (v: number) => (v < 0 ? `− ${dp(-v)}` : `+ ${dp(v)}`);

function Grid() {
  return (
    <>
      <defs>
        <clipPath id="grid-clip">
          <rect x={gx(-4.75)} y={gy(3)} width={380} height={240} />
        </clipPath>
      </defs>
      {[-4, -3, -2, -1, 0, 1, 2, 3, 4].map((i) => (
        <line key={`v${i}`} x1={gx(i)} x2={gx(i)} y1={gy(-3)} y2={gy(3)} className={i === 0 ? "fig-axis" : "fig-grid"} />
      ))}
      {[-3, -2, -1, 0, 1, 2, 3].map((i) => (
        <line key={`h${i}`} x1={gx(-4.75)} x2={gx(4.75)} y1={gy(i)} y2={gy(i)} className={i === 0 ? "fig-axis" : "fig-grid"} />
      ))}
    </>
  );
}

function Arrow({ from = [0, 0], to, accent = false, dashed = false, name }: { from?: Pair; to: Pair; accent?: boolean; dashed?: boolean; name?: string }) {
  const [x0, y0, x1, y1] = [gx(from[0]), gy(from[1]), gx(to[0]), gy(to[1])];
  const length = Math.hypot(x1 - x0, y1 - y0);
  const stroke = dashed ? "fig-guide" : accent ? "fig-accent-line" : "fig-line";
  if (length < 1) return <circle cx={x0} cy={y0} r="3" className={accent ? "fig-accent" : "fig-fill"} />;
  const [ux, uy] = [(x1 - x0) / length, (y1 - y0) / length];
  const head = `${(x1 - 9 * ux + 5 * uy).toFixed(1)},${(y1 - 9 * uy - 5 * ux).toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)} ${(x1 - 9 * ux - 5 * uy).toFixed(1)},${(y1 - 9 * uy + 5 * ux).toFixed(1)}`;
  return (
    <>
      <line x1={x0} y1={y0} x2={x1} y2={y1} className={stroke} />
      <polyline points={head} className={stroke} fill="none" />
      {name ? (
        <text x={x1 + 8 * ux - 4} y={y1 + 8 * uy + 4} className="fig-small">
          {name}
        </text>
      ) : null}
    </>
  );
}

const TAILS: Pair[] = [
  [0, 0],
  [1, 1],
  [-1, -1],
  [1.5, -1],
];

/** A vector as an arrow and as a list of two numbers, and the fact that moving the arrow does not change the vector. */
function VectorArrow(props: Props) {
  const [x, setX] = useState(clamp(num(props.x, 3), -3, 3));
  const [y, setY] = useState(clamp(num(props.y, 2), -2, 2));
  const [tail, setTail] = useState(0);
  const from = TAILS[tail];
  const to: Pair = [from[0] + x, from[1] + y];
  const across = x === 0 ? "0 across" : `${dp(Math.abs(x))} ${x > 0 ? "right" : "left"}`;
  const up = y === 0 ? "0 up" : `${dp(Math.abs(y))} ${y > 0 ? "up" : "down"}`;
  return (
    <Frame
      title="An arrow and a list"
      summary={`The vector ${pair([x, y])}, drawn from ${pair(from)} to ${pair(to)}: ${across} and ${up}. Its length is ${dp(Math.hypot(x, y))}. ${tail === 0 ? "Drawn from the origin, its tip is at the point with the same two numbers." : "It has been moved, and it is still the same vector: the same two numbers, the same length, the same direction."}`}
      controls={
        <>
          <Slider label="across" value={x} onChange={setX} min={-3} max={3} step={0.5} />
          <Slider label="up" value={y} onChange={setY} min={-2} max={2} step={0.5} />
          <button type="button" className="btn btn-secondary btn-small" onClick={() => setTail((tail + 1) % TAILS.length)}>
            Move the arrow
          </button>
        </>
      }
    >
      <svg viewBox="0 0 440 280" role="img" aria-label={`An arrow from ${pair(from)} to ${pair(to)}`}>
        <Grid />
        <line x1={gx(from[0])} y1={gy(from[1])} x2={gx(to[0])} y2={gy(from[1])} className="fig-guide" />
        <line x1={gx(to[0])} y1={gy(from[1])} x2={gx(to[0])} y2={gy(to[1])} className="fig-guide" />
        <Arrow from={from} to={to} accent />
      </svg>
    </Frame>
  );
}

/** Adding two vectors tip to tail, in either order, with one of them scaled. */
function VectorSum(props: Props) {
  const a: Pair = [clamp(num(props.ax, 2), -2, 2), clamp(num(props.ay, 1), -1, 1)];
  const b: Pair = [clamp(num(props.bx, 1), -1, 1), clamp(num(props.by, 1), -1, 1)];
  const [halves, setHalves] = useState(clamp(Math.round(num(props.scale, 1) * 2), -4, 4));
  const [bFirst, setBFirst] = useState(false);
  const c = halves / 2;
  const cb: Pair = [c * b[0], c * b[1]];
  const sum: Pair = [a[0] + cb[0], a[1] + cb[1]];
  const scaled = c === 1 ? "b" : c === -1 ? "−b" : `${dp(c)}b`;
  const term = c < 0 ? `(${scaled})` : scaled;
  const effect = c === 0 ? "Scaling by 0 gives the zero vector, so the sum is a itself." : c < 0 ? `A negative scale turns b round to point the opposite way${c === -1 ? "" : ` and makes it ${dp(Math.abs(c))} times as long`}.` : c === 1 ? "" : `Scaling by ${dp(c)} keeps b's direction and makes it ${dp(c)} times as long.`;
  return (
    <Frame
      title="Adding tip to tail"
      summary={`a = ${pair(a)} and b = ${pair(b)}${c === 1 ? "" : `, so ${scaled} = ${pair(cb)}`}. ${bFirst ? `Walk along ${scaled}, then along a` : `Walk along a, then along ${scaled}`}: you arrive at a + ${term} = (${dp(a[0])} ${signed(cb[0])}, ${dp(a[1])} ${signed(cb[1])}) = ${pair(sum)}. Either order arrives at the same place. ${effect}`.trim()}
      controls={
        <>
          <Slider label="scale of b in halves" value={halves} onChange={setHalves} min={-4} max={4} />
          <button type="button" className="btn btn-secondary btn-small" onClick={() => setBFirst(!bFirst)}>
            Swap the order
          </button>
        </>
      }
    >
      <svg viewBox="0 0 440 280" role="img" aria-label={`The vectors a and ${scaled} added tip to tail, giving ${pair(sum)}`}>
        <Grid />
        <Arrow to={bFirst ? a : cb} dashed />
        <Arrow from={bFirst ? a : cb} to={sum} dashed />
        <Arrow to={bFirst ? cb : a} name={bFirst ? scaled : "a"} />
        <Arrow from={bFirst ? cb : a} to={sum} name={bFirst ? "a" : scaled} />
        <Arrow to={sum} accent />
      </svg>
    </Frame>
  );
}

/** Every point two vectors can reach by scaling and adding: the whole plane, or only a line when they point the same way. */
function Span(props: Props) {
  const a: Pair = [1.5, 0.5];
  const [parallel, setParallel] = useState(props.parallel === true);
  const b: Pair = parallel ? [-0.75, -0.25] : [0.5, 1];
  const [sq, setSq] = useState(clamp(Math.round(num(props.s, 1) * 4), -8, 8));
  const [tq, setTq] = useState(clamp(Math.round(num(props.t, 1) * 4), -8, 8));
  const [s, t] = [sq / 4, tq / 4];
  const at: Pair = [s * a[0] + t * b[0], s * a[1] + t * b[1]];
  const reach: Pair[] = [];
  for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) reach.push([(i / 2) * a[0] + (j / 2) * b[0], (i / 2) * a[1] + (j / 2) * b[1]]);
  return (
    <Frame
      title="What two vectors can reach"
      summary={`a = ${pair(a)} and b = ${pair(b)}. The combination ${dp(s)}a + ${dp(t)}b is ${pair(at)}. ${
        parallel
          ? "Here b is −0.5 times a, so every combination lies on the one line through a. The two vectors span only a line, and b reaches nothing that a could not reach alone."
          : "Because a and b point in different directions, some choice of the two numbers reaches any point of the plane. The two vectors span the plane."
      }`}
      controls={
        <>
          <Slider label="multiple of a in quarters" value={sq} onChange={setSq} min={-8} max={8} />
          <Slider label="multiple of b in quarters" value={tq} onChange={setTq} min={-8} max={8} />
          <button type="button" className="btn btn-secondary btn-small" onClick={() => setParallel(!parallel)}>
            {parallel ? "Turn b away from a" : "Put b along a"}
          </button>
        </>
      }
    >
      <svg viewBox="0 0 440 280" role="img" aria-label={`The points reachable from a and b, with ${dp(s)}a + ${dp(t)}b marked at ${pair(at)}`}>
        <Grid />
        {reach.map(([px, py], i) => (
          <circle key={i} cx={gx(px)} cy={gy(py)} r="2" className="fig-fill" />
        ))}
        <Arrow to={[s * a[0], s * a[1]]} dashed />
        <Arrow from={[s * a[0], s * a[1]]} to={at} dashed />
        <Arrow to={a} name="a" />
        <Arrow to={b} name="b" />
        <circle cx={gx(at[0])} cy={gy(at[1])} r="5" className="fig-accent" />
      </svg>
    </Frame>
  );
}

/** The dot product as one vector's length times the other's shadow on it, changing sign as the angle opens. */
function DotProduct(props: Props) {
  const a: Pair = [3, 0];
  const [angle, setAngle] = useState(clamp(Math.round(num(props.angle, 45) / 15) * 15, 0, 345));
  const [halves, setHalves] = useState(clamp(Math.round(num(props.length, 2) * 2), 1, 6));
  const length = halves / 2;
  const b: Pair = [length * Math.cos((angle * Math.PI) / 180), length * Math.sin((angle * Math.PI) / 180)];
  const product = dot(a, b);
  const shadow = b[0];
  const between = angle > 180 ? 360 - angle : angle;
  const tidy = (v: number) => (Math.abs(v) < 1e-9 ? 0 : v);
  const verdict =
    tidy(product) === 0
      ? "The dot product is zero: b is at a right angle to a and has no part along it."
      : product > 0
        ? "The dot product is positive: b points partly along a."
        : "The dot product is negative: b points partly against a.";
  return (
    <Frame
      title="The dot product and the shadow"
      summary={`a = ${pair(a)} and b = ${pair([tidy(b[0]), tidy(b[1])])}, of length ${dp(length)}, with ${between}° between them. a · b = 3 × ${dp(tidy(b[0]))} + 0 × ${dp(tidy(b[1]))} = ${dp(tidy(product))}. The shadow of b on a has length ${dp(tidy(shadow))}, and 3 × ${dp(tidy(shadow))} gives the same number. ${verdict}`}
      controls={
        <>
          <Slider label="angle of b in degrees" value={angle} onChange={setAngle} min={0} max={345} step={15} />
          <Slider label="length of b in halves" value={halves} onChange={setHalves} min={1} max={6} />
        </>
      }
    >
      <svg viewBox="0 0 440 280" role="img" aria-label={`The vector b at ${between} degrees to a, with its shadow on a`}>
        <Grid />
        <line x1={gx(b[0])} y1={gy(b[1])} x2={gx(b[0])} y2={gy(0)} className="fig-guide" />
        <Arrow to={a} name="a" />
        <Arrow to={b} name="b" />
        <line x1={gx(0)} y1={gy(0)} x2={gx(shadow)} y2={gy(0)} className="fig-accent-line" />
        <circle cx={gx(shadow)} cy={gy(0)} r="4" className="fig-accent" />
      </svg>
    </Frame>
  );
}

const NORMS = [
  { name: "Euclidean", symbol: "‖x‖₂", shape: "a circle", f: (x: number, y: number) => Math.hypot(x, y), how: (x: number, y: number) => `√(${dp(x)}² + ${dp(y)}²)` },
  { name: "taxicab", symbol: "‖x‖₁", shape: "a diamond", f: (x: number, y: number) => Math.abs(x) + Math.abs(y), how: (x: number, y: number) => `${dp(Math.abs(x))} + ${dp(Math.abs(y))}` },
  { name: "maximum", symbol: "‖x‖∞", shape: "a square", f: (x: number, y: number) => Math.max(Math.abs(x), Math.abs(y)), how: (x: number, y: number) => `the larger of ${dp(Math.abs(x))} and ${dp(Math.abs(y))}` },
];

/** Three ways of measuring the length of the same vector, and the shape of "all points at distance 1" under each. */
function NormBalls(props: Props) {
  const [xq, setXq] = useState(clamp(Math.round(num(props.x, 1.5) * 4), -12, 12));
  const [yq, setYq] = useState(clamp(Math.round(num(props.y, 1) * 4), -10, 10));
  const [which, setWhich] = useState(clamp(Math.round(num(props.norm, 0)), 0, 2));
  const [x, y] = [xq / 4, yq / 4];
  const norm = NORMS[which];
  const size = norm.f(x, y);
  const ball = (r: number) =>
    which === 0 ? (
      <circle cx={gx(0)} cy={gy(0)} r={40 * r} className={r === 1 ? "fig-line" : "fig-ghost"} />
    ) : which === 1 ? (
      <polygon points={`${gx(r)},${gy(0)} ${gx(0)},${gy(r)} ${gx(-r)},${gy(0)} ${gx(0)},${gy(-r)}`} className={r === 1 ? "fig-line" : "fig-ghost"} />
    ) : (
      <rect x={gx(-r)} y={gy(r)} width={80 * r} height={80 * r} className={r === 1 ? "fig-line" : "fig-ghost"} />
    );
  return (
    <Frame
      title="Three ways to measure length"
      summary={`The vector ${pair([x, y])}. Its ${norm.name} norm ${norm.symbol} is ${norm.how(x, y)} = ${dp(size)}. With this norm the points at distance 1 from the origin form ${norm.shape}. All three norms of this vector: Euclidean ${dp(NORMS[0].f(x, y))}, taxicab ${dp(NORMS[1].f(x, y))}, maximum ${dp(NORMS[2].f(x, y))}.`}
      controls={
        <>
          <Slider label="across in quarters" value={xq} onChange={setXq} min={-12} max={12} />
          <Slider label="up in quarters" value={yq} onChange={setYq} min={-10} max={10} />
          <button type="button" className="btn btn-secondary btn-small" aria-label="Change norm" onClick={() => setWhich((which + 1) % 3)}>
            {norm.name} norm
          </button>
        </>
      }
    >
      <svg viewBox="0 0 440 280" role="img" aria-label={`The vector ${pair([x, y])} with the set of points at ${norm.name} distance 1 and at distance ${dp(size)}`}>
        <Grid />
        {size > 0 ? ball(size) : null}
        {ball(1)}
        <Arrow to={[x, y]} accent />
      </svg>
    </Frame>
  );
}

/** The nearest point to b on the line through a, and the leftover that is perpendicular to a. */
function Projection(props: Props) {
  const a: Pair = [3, 1];
  const [bx, setBx] = useState(clamp(Math.round(num(props.bx, 1) * 2) / 2, -4, 4));
  const [by, setBy] = useState(clamp(Math.round(num(props.by, 2) * 2) / 2, -2.5, 2.5));
  const b: Pair = [bx, by];
  const k = dot(a, b) / dot(a, a);
  const p: Pair = [k * a[0], k * a[1]];
  const e: Pair = [b[0] - p[0], b[1] - p[1]];
  return (
    <Frame
      title="Projection onto a line"
      summary={`a = ${pair(a)} and b = ${pair(b)}. a · b = ${dp(dot(a, b))} and a · a = 10, so the projection of b onto a is ${dp(k)} times a, which is p = ${pair(p)}. What is left over, b − p = ${pair(e)}, is at a right angle to a: its dot product with a is 0. No point on the line through a is nearer to b than p, and the distance is ${dp(Math.hypot(e[0], e[1]))}.`}
      controls={
        <>
          <Slider label="b across" value={bx} onChange={setBx} min={-4} max={4} step={0.5} />
          <Slider label="b up" value={by} onChange={setBy} min={-2.5} max={2.5} step={0.5} />
        </>
      }
    >
      <svg viewBox="0 0 440 280" role="img" aria-label={`The vector b, its projection ${pair(p)} on the line through a, and the perpendicular from b to the line`}>
        <Grid />
        <line x1={gx(-6)} y1={gy(-2)} x2={gx(6)} y2={gy(2)} className="fig-ghost" clipPath="url(#grid-clip)" />
        <line x1={gx(b[0])} y1={gy(b[1])} x2={gx(p[0])} y2={gy(p[1])} className="fig-guide" />
        <Arrow to={a} name="a" />
        <Arrow to={b} name="b" />
        <Arrow to={p} accent />
        <circle cx={gx(p[0])} cy={gy(p[1])} r="4" className="fig-accent" />
      </svg>
    </Frame>
  );
}

/** A line as the set of points where w · x + c is zero, with w at right angles to it and a sign on each side. */
function Hyperplane(props: Props) {
  const [w1h, setW1] = useState(clamp(Math.round(num(props.w1, 1) * 2), -4, 4));
  const [w2h, setW2] = useState(clamp(Math.round(num(props.w2, 2) * 2), -4, 4));
  const [ch, setC] = useState(clamp(Math.round(num(props.c, -2) * 2), -8, 8));
  const point: Pair = [clamp(num(props.px, 2), -4, 4), clamp(num(props.py, 1), -2.5, 2.5)];
  const w: Pair = [w1h / 2, w2h / 2];
  const c = ch / 2;
  const size = Math.hypot(w[0], w[1]);
  const value = dot(w, point) + c;
  const foot: Pair = size === 0 ? [0, 0] : [(-c * w[0]) / (size * size), (-c * w[1]) / (size * size)];
  const along: Pair = size === 0 ? [0, 0] : [-w[1] / size, w[0] / size];
  const side = value === 0 ? "which is zero, so the point is on the line." : `which is ${value > 0 ? "positive" : "negative"}, so the point is on the side that w points ${value > 0 ? "towards" : "away from"}, at a distance of ${dp(Math.abs(value))} ÷ ${dp(size)} = ${dp(Math.abs(value) / size)} from the line.`;
  return (
    <Frame
      title="A line from a vector and a number"
      summary={
        size === 0
          ? `With w = (0, 0) the expression w · x ${signed(c)} is ${dp(c)} at every point, so it describes no line at all.`
          : `The line ${dp(w[0])}x + ${dp(w[1])}y ${signed(c)} = 0. The vector w = ${pair(w)} is at right angles to it. At the point ${pair(point)} the expression is ${dp(w[0])} × ${dp(point[0])} + ${dp(w[1])} × ${dp(point[1])} ${signed(c)} = ${dp(value)}, ${side}`
      }
      controls={
        <>
          <Slider label="first weight in halves" value={w1h} onChange={setW1} min={-4} max={4} />
          <Slider label="second weight in halves" value={w2h} onChange={setW2} min={-4} max={4} />
          <Slider label="offset in halves" value={ch} onChange={setC} min={-8} max={8} />
        </>
      }
    >
      <svg viewBox="0 0 440 280" role="img" aria-label={size === 0 ? "No line" : `The line with normal vector ${pair(w)} and the point ${pair(point)}`}>
        <Grid />
        {size === 0 ? null : (
          <>
            <g clipPath="url(#grid-clip)">
              <line x1={gx(foot[0] - 12 * along[0])} y1={gy(foot[1] - 12 * along[1])} x2={gx(foot[0] + 12 * along[0])} y2={gy(foot[1] + 12 * along[1])} className="fig-accent-line" />
            </g>
            <Arrow from={foot} to={[foot[0] + w[0], foot[1] + w[1]]} name="w" />
          </>
        )}
        <circle cx={gx(point[0])} cy={gy(point[1])} r="5" className="fig-accent" />
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
  "plane-point": PlanePoint,
  "plane-line": PlaneLine,
  "plane-lines": PlaneLines,
  parabola: Parabola,
  venn: Venn,
  "arrow-map": ArrowMap,
  "inverse-line": InverseLine,
  growth: Growth,
  "unit-circle": UnitCircle,
  "triangle-sum": TriangleSum,
  "partial-sums": PartialSums,
  "call-stack": CallStack,
  "growth-rates": GrowthRates,
  "truth-table": TruthTable,
  dominoes: Dominoes,
  diagonal: Diagonal,
  "epsilon-band": EpsilonBand,
  "remainder-classes": RemainderClasses,
  "quantifier-grid": QuantifierGrid,
  "limit-approach": LimitApproach,
  secant: Secant,
  "chain-rates": ChainRates,
  bend: Bend,
  taylor: Taylor,
  descent: Descent,
  riemann: Riemann,
  accumulation: Accumulation,
  "vector-arrow": VectorArrow,
  "vector-sum": VectorSum,
  span: Span,
  "dot-product": DotProduct,
  "norm-balls": NormBalls,
  projection: Projection,
  hyperplane: Hyperplane,
};

export function Figure({ name, props }: { name: string; props?: Props }) {
  const Drawn = (FIGURES as Record<string, ComponentType<Props>>)[name];
  return Drawn ? <Drawn {...(props ?? {})} /> : null;
}
