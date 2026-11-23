/** Names of the interactive figures lessons can place. Each has a component in components/lesson/figures.tsx. */
export const FIGURE_NAMES = ["place-value", "number-line", "area-grid", "fraction-bar", "powers-of-ten", "ratio-table"] as const;
export type FigureName = (typeof FIGURE_NAMES)[number];
