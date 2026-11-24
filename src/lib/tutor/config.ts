/** Settings for the tutor. Every one has a default, so only ANTHROPIC_API_KEY has to be set. */

/** US dollars per million tokens. A cache write is billed at twice the input price for a one-hour cache. */
const PRICES: Record<string, { input: number; output: number; cacheRead: number }> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.1 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01 },
};
const CACHE_WRITE_FACTOR = 2;

export const DEFAULT_MODEL = "claude-opus-5-5";
export const DEFAULT_MONTHLY_USD = 20;
export const MAX_MESSAGE_CHARS = 4000;
/** Earlier turns sent with each question. Older ones stay on screen but are not sent again. */
export const HISTORY_TURNS = 16;

export const tutorModel = () => process.env.AXIOM_TUTOR_MODEL?.trim() || DEFAULT_MODEL;

const EFFORTS = ["low", "medium", "high"] as const;
export function tutorEffort(): (typeof EFFORTS)[number] {
  const value = process.env.AXIOM_TUTOR_EFFORT?.trim() as (typeof EFFORTS)[number] | undefined;
  return value && EFFORTS.includes(value) ? value : "low";
}

/** The most the tutor may spend in a calendar month. It stops answering once this is reached. */
export function monthlyBudgetUsd(): number {
  const value = Number(process.env.AXIOM_TUTOR_MONTHLY_USD);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_MONTHLY_USD;
}

export const tutorConnected = () => Boolean(process.env.ANTHROPIC_API_KEY);

export type Usage = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

/**
 * What one reply cost, in millionths of a dollar, rounded up.
 * A model that is not in the table is charged at the dearest rate, so the budget errs on the safe side.
 */
export function costMicroUsd(model: string, usage: Usage): number {
  const price = PRICES[model] ?? PRICES[DEFAULT_MODEL];
  return Math.ceil(
    (usage.input_tokens ?? 0) * price.input +
      (usage.cache_creation_input_tokens ?? 0) * price.input * CACHE_WRITE_FACTOR +
      (usage.cache_read_input_tokens ?? 0) * price.cacheRead +
      (usage.output_tokens ?? 0) * price.output,
  );
}
