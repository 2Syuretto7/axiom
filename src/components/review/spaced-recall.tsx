import { after } from "next/server";
import { getDb } from "@/lib/db";
import { content } from "@/lib/lessons/content";
import { prepareQuestion } from "@/lib/review/prepare";
import { RECALLS_PER_LESSON, reviewQueue } from "@/lib/review/schedule";
import { dueBy, rememberFinishedLessons, showIn, shownIn } from "@/lib/review/service";
import { recallView } from "@/lib/review/view";
import { tutorConnected } from "@/lib/tutor/config";
import { RecallCard } from "./recall-card";

const DAY = 86_400_000;
/** Questions are written ahead for ideas that fall due within this many days, so the next lesson rarely waits for them. */
const WRITE_AHEAD_DAYS = 2;

/**
 * The spaced part of a lesson's Recall: earlier ideas whose time has come,
 * each with a question written for this one occasion and never shown again.
 *
 * Which ideas appear is decided by the memory model, not by the lesson: the
 * ones most likely to have been forgotten, at most RECALLS_PER_LESSON of them.
 * Once a question has been placed in a lesson it stays there on every visit.
 * If no new question can be written for an idea, the idea is left out. An old
 * question is never used instead.
 */
export async function SpacedRecall({ userId, lessonId }: { userId: string; lessonId: string }) {
  const db = getDb();
  let shown = await shownIn(db, userId, lessonId);

  if (tutorConnected() && shown.length < RECALLS_PER_LESSON) {
    await rememberFinishedLessons(db, userId);
    const now = new Date();
    const { lessons } = content();
    const here = new Set(shown.map((row) => row.conceptId));
    const memories = (await dueBy(db, userId, new Date(now.getTime() + WRITE_AHEAD_DAYS * DAY))).filter(
      (memory) => lessons.has(memory.conceptId) && memory.conceptId !== lessonId && !here.has(memory.conceptId),
    );
    const due = reviewQueue(memories, now);
    const picked = due.slice(0, RECALLS_PER_LESSON - shown.length);
    const written = await Promise.all(picked.map((id) => prepareQuestion(db, userId, id)));
    for (const question of written) if (question) await showIn(db, userId, question.id, lessonId);
    if (written.some(Boolean)) shown = await shownIn(db, userId, lessonId);

    const ahead = [...due, ...memories.map((memory) => memory.conceptId)].filter((id, i, all) => !picked.includes(id) && all.indexOf(id) === i);
    after(async () => {
      for (const id of ahead.slice(0, RECALLS_PER_LESSON)) await prepareQuestion(db, userId, id);
    });
  }

  if (shown.length === 0) return null;
  const one = shown.length === 1;
  return (
    <div className="recall-spaced" role="group" aria-label="Recall from earlier lessons">
      <p className="lesson-text recall-spaced-note">
        {one ? "One idea from an earlier lesson is" : `${shown.length} ideas from earlier lessons are`} due to be recalled. {one ? "Its question is" : "Their questions are"} new:
        you have never seen {one ? "it" : "them"} before and will never see {one ? "it" : "them"} again. One try each, from memory, with no hints.
      </p>
      {shown.map((row, i) => (
        <RecallCard key={row.id} view={recallView(row)} number={i + 1} />
      ))}
    </div>
  );
}
