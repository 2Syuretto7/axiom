"use client";

import { createContext, useContext } from "react";
import type { AnswerResult } from "@/lib/learning/actions";

export type CodeVerdict = { correct: boolean; note?: string; explanationHtml?: string };

export type WorkspaceApi = {
  conceptId: string;
  total: number;
  solved: ReadonlySet<string>;
  complete: boolean;
  /** Record the outcome of an answer so progress and the end of the lesson update. */
  settle: (questionId: string, result: AnswerResult) => void;
  /** The code question whose answer is in the editor, if any. */
  active: string | null;
  open: (question: { id: string; number: number; starter: string }) => void;
  check: () => void;
  busy: boolean;
  verdicts: Readonly<Record<string, CodeVerdict>>;
};

export const WorkspaceContext = createContext<WorkspaceApi | null>(null);

export function useWorkspace(): WorkspaceApi {
  const api = useContext(WorkspaceContext);
  if (!api) throw new Error("Used outside the workspace");
  return api;
}
