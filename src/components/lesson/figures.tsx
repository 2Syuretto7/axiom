import type { ComponentType } from "react";
import type { FigureName } from "@/lib/lessons/figures";

/** Every figure is drawn in the app as interactive SVG or canvas. None is an image file. */
export const FIGURES: Record<FigureName, ComponentType<Record<string, unknown>>> = {};
