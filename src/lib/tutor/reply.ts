import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { HISTORY_TURNS, tutorEffort, tutorModel, type Usage } from "./config";
import type { TutorMessage } from "./service";

let client: Anthropic | undefined;

export type Reply = { text: string; usage: Usage; model: string; refused: boolean; cutShort: boolean };

/**
 * Asks the model for the tutor's next reply and passes the text on as it arrives.
 * `system` is the same for every question in a lesson, so it is cached for an hour and
 * later questions pay a small fraction of its price.
 */
export async function streamReply(input: {
  system: string;
  history: TutorMessage[];
  message: string;
  note: string;
  onText: (delta: string) => void;
}): Promise<Reply> {
  client ??= new Anthropic();
  const model = tutorModel();
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...input.history.slice(-HISTORY_TURNS).map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: input.note ? `${input.note}\n\n${input.message}` : input.message },
  ];
  // The API wants the conversation to open with the learner.
  while (messages[0].role !== "user") messages.shift();

  const stream = client.beta.messages.stream({
    model,
    max_tokens: 8000,
    output_config: { effort: tutorEffort() },
    // If the model declines a question for policy reasons, the API retries it once on its default substitute.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [{ type: "text", text: input.system, cache_control: { type: "ephemeral", ttl: "1h" } }],
    messages,
  });
  stream.on("text", input.onText);
  const final = await stream.finalMessage();
  const text = final.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
  return { text, usage: final.usage, model, refused: final.stop_reason === "refusal", cutShort: final.stop_reason === "max_tokens" };
}

/** A sentence for the learner when the request fails. Never includes details of the failure. */
export function failureNote(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return "The tutor's API key was not accepted. Check ANTHROPIC_API_KEY in Vercel.";
  }
  if (error instanceof Anthropic.RateLimitError) return "The tutor is being asked too much at once. Wait a minute and try again.";
  if (error instanceof Anthropic.BadRequestError) return "The tutor could not take that message. Try asking it in a shorter form.";
  if (error instanceof Anthropic.APIConnectionError) return "The tutor could not be reached. Check your connection and try again.";
  if (error instanceof Anthropic.APIError && (error.status ?? 0) >= 500) return "The tutor's service is having trouble. Try again in a minute.";
  return "The tutor could not answer just now. Try again.";
}
