/** Names of the interactive figures lessons can place. Each has a component in components/lesson/figures.tsx. */
export const FIGURE_NAMES = [] as const;
export type FigureName = (typeof FIGURE_NAMES)[number];
