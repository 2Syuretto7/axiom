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
};

export function Figure({ name, props }: { name: string; props?: Props }) {
  const Drawn = (FIGURES as Record<string, ComponentType<Props>>)[name];
  return Drawn ? <Drawn {...(props ?? {})} /> : null;
}
