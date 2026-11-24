import { after } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { nextAfter } from "@/lib/learning/next";
import { completedConcepts, hintLevels, solvedQuestions } from "@/lib/learning/service";
import { content } from "@/lib/lessons/content";
import { costMicroUsd, MAX_MESSAGE_CHARS, tutorConnected } from "@/lib/tutor/config";
import { systemPrompt, workspaceNote } from "@/lib/tutor/prompt";
import { failureNote, streamReply } from "@/lib/tutor/reply";
import { questionEffort, saveTutorMessage, tutorHistory } from "@/lib/tutor/service";

export const maxDuration = 120;

const body = z.object({
  conceptId: z.string().min(1).max(200),
  message: z.string().trim().min(1).max(MAX_MESSAGE_CHARS),
  questionId: z.string().max(200).nullish(),
  code: z.string().max(50_000).optional(),
  output: z.string().max(50_000).optional(),
});

const refuse = (status: number, error: string) => Response.json({ error }, { status });

/**
 * One question to the tutor. The reply streams back as lines of JSON:
 * {"delta": "..."} as text arrives, then {"done": true} or {"error": "..."}.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return refuse(401, "You are signed out. Sign in again to ask the tutor.");
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return refuse(400, `Messages to the tutor can be up to ${MAX_MESSAGE_CHARS} characters.`);
  if (!tutorConnected()) return refuse(503, "The tutor is not connected yet. It needs ANTHROPIC_API_KEY in this deployment.");

  const db = getDb();
  const { graph, lessons } = content();
  const { conceptId, message, questionId, code, output } = parsed.data;
  const lesson = lessons.get(conceptId) ?? null;
  if (!lesson && conceptId !== "scratch") return refuse(404, "That lesson does not exist.");

  const [completed, solved, history, effort, hints] = await Promise.all([
    completedConcepts(db, user.id),
    lesson ? solvedQuestions(db, user.id, lesson.concept) : new Set<string>(),
    tutorHistory(db, user.id, conceptId),
    lesson ? questionEffort(db, user.id, lesson.concept) : undefined,
    lesson ? hintLevels(db, user.id, lesson.concept) : undefined,
  ]);
  const system = systemPrompt({
    graph,
    completed: completed.filter((id) => id !== conceptId),
    lesson,
    next: lesson ? nextAfter(graph, new Set(lessons.keys()), completed, lesson.concept) : null,
  });
  const note = workspaceNote(lesson, { questionId, code, output, solved: [...solved], effort, hints });
  await saveTutorMessage(db, user.id, conceptId, "user", message);

  const encoder = new TextEncoder();
  let send: (event: object) => void = () => {};
  let close = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // If the learner leaves mid-reply these fail quietly; the reply is still finished and saved.
      send = (event) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {}
      };
      close = () => {
        try {
          controller.close();
        } catch {}
      };
    },
  });

  const work = (async () => {
    try {
      const reply = await streamReply({ system, history, message, note, onText: (delta) => send({ delta }) });
      const cost = costMicroUsd(reply.model, reply.usage);
      let text = reply.text;
      if (reply.refused || !text.trim()) {
        text = "I cannot help with that one. Ask me about the lesson or your code instead.";
        send({ replace: text });
      } else if (reply.cutShort) {
        const tail = "\n\n(The reply was cut short. Ask me to continue.)";
        text += tail;
        send({ delta: tail });
      }
      await saveTutorMessage(db, user.id, conceptId, "assistant", text, cost);
      send({ done: true });
    } catch (error) {
      console.error("tutor", error instanceof Error ? error.name : "error");
      send({ error: failureNote(error) });
    } finally {
      close();
    }
  })();
  after(() => work);

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
