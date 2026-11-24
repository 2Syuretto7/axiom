/** Names of the interactive figures lessons can place. Each has a component in components/lesson/figures.tsx. */
export const FIGURE_NAMES = ["place-value", "number-line", "area-grid", "fraction-bar", "powers-of-ten", "ratio-table", "plane-point", "plane-line", "plane-lines", "parabola", "venn", "arrow-map", "inverse-line", "growth", "unit-circle", "triangle-sum", "partial-sums", "call-stack", "growth-rates"] as const;
export type FigureName = (typeof FIGURE_NAMES)[number];
