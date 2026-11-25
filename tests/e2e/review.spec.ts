import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";

// Runs after the fixture lessons are all finished, as the same learner.
test.describe.configure({ mode: "serial" });

const url = process.env.E2E_DATABASE_URL ?? "postgres://axiom:axiom@localhost:5432/axiom_e2e";
const MOCK = "http://localhost:3199";

async function sql<T extends Record<string, unknown>>(text: string, values: unknown[] = []): Promise<T[]> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    return (await client.query(text, values)).rows as T[];
  } finally {
    await client.end();
  }
}

const card = (page: Page) => page.getByRole("region", { name: "Review question" });
/** The number of sheep in the first field, which the stand-in model changes with every question it writes. */
const sheep = async (page: Page) => Number((await card(page).locator(".q-prompt").innerText()).match(/has (\d+) sheep/)![1]);

async function answer(page: Page, value: string) {
  await card(page).getByRole("textbox").fill(value);
  await card(page).getByRole("button", { name: "Check" }).click();
}

test("finished lessons come back when due, each time with a question never seen before", async ({ page, request }) => {
  // Nothing is due straight after the lessons, so no review is given and no question is written.
  await page.goto("/learn");
  await expect(page.getByRole("heading", { level: 1, name: "You have finished every lesson written so far." })).toBeVisible();
  expect(await sql("select 1 from review_questions")).toEqual([]);
  expect((await sql("select 1 from review_states")).length).toBe(3);

  // Five weeks pass.
  await sql("update lesson_progress set completed_at = completed_at - interval '35 days', started_at = started_at - interval '35 days'");
  await sql("delete from review_states");

  await page.goto("/learn");
  await expect(card(page)).toBeVisible({ timeout: 30_000 });
  const title = await page.getByRole("heading", { level: 1 }).innerText();
  expect(["Counting", "Adding", "Printing"]).toContain(title);
  await expect(page.getByText(/^Review · (M0|E0) · /)).toBeVisible();
  await expect(page.getByText("You last worked on this lesson 35 days ago.")).toBeVisible();
  // The first question written failed its independent check, so it was thrown away and this is the second.
  const first = await sheep(page);
  expect(first).toBe(2);
  // The question is the model's own text: mathematics is typeset, and raw HTML is shown as text, not run.
  await expect(card(page).locator(".katex").first()).toBeVisible();
  await expect(card(page).locator("b")).toHaveCount(0);
  await expect(card(page)).toContainText("<b>How many</b>");
  // The answer is not in the page before the question is answered.
  expect(await page.content()).not.toContain("Count on from 10");

  // What the model was sent: a lesson under review, and the same model and care as the tutor.
  // (Questions for the other two lessons are written in the background, so the last request may be for any of them.)
  const sent = (await (await request.get(`${MOCK}/last`)).json()) as {
    body: { model: string; output_config: { effort: string; format: { type: string } }; system: { text: string; cache_control?: unknown }[] };
  };
  expect(sent.body.model).toBe("claude-opus-5-5");
  expect(sent.body.output_config.effort).toBe("medium");
  expect(sent.body.output_config.format.type).toBe("json_schema");
  expect(sent.body.system[0].text).toMatch(/# The lesson under review\nLesson: (Counting|Adding|Printing)\n/);
  expect(sent.body.system[0].cache_control).toEqual({ type: "ephemeral", ttl: "1h" });

  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes[0]?.target})`)).toEqual([]);
  await page.screenshot({ path: "test-results/screens/review-phone.png" });

  // A reload shows the same waiting question; it is not written again.
  await page.reload();
  expect(await sheep(page)).toBe(first);

  // Something that is not a number does not use up the one try.
  await answer(page, "twelve");
  await expect(card(page)).toContainText("Enter a number");
  await answer(page, String(first + 10));
  await expect(card(page)).toContainText("Recalled");
  await expect(card(page)).toContainText("Count on from 10");
  await expect(card(page).getByRole("button", { name: "Check" })).toBeDisabled();
  await expect(page.getByText(/This lesson comes back in \d+ days, with a different question\./)).toBeVisible();

  // The second lesson due: a different question, answered wrongly this time.
  await page.getByRole("link", { name: "Continue" }).click();
  await expect(card(page)).toBeVisible({ timeout: 30_000 });
  const second = await sheep(page);
  expect(second).not.toBe(first);
  await answer(page, "1");
  await expect(card(page)).toContainText("Missed");
  await expect(card(page)).toContainText("Not this time. The answer is:");
  await expect(card(page)).toContainText(`${second + 10} sheep`);
  await expect(page.getByText(/This lesson comes back in [1-9] days?, with a different question\./)).toBeVisible();
  await page.screenshot({ path: "test-results/screens/review-missed-phone.png" });

  // The third, and then nothing is due and Learn carries on as before.
  await page.getByRole("link", { name: "Continue" }).click();
  await expect(card(page)).toBeVisible({ timeout: 30_000 });
  const third = await sheep(page);
  await answer(page, String(third + 10));
  await expect(card(page)).toContainText("Recalled");
  await page.getByRole("link", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "You have finished every lesson written so far." })).toBeVisible();

  const asked = await sql<{ concept_id: string; correct: boolean; fingerprint: string }>("select concept_id, correct, fingerprint from review_questions order by id");
  expect(asked.map((row) => row.correct)).toEqual([true, false, true]);
  expect(new Set(asked.map((row) => row.concept_id)).size).toBe(3);
  expect(new Set(asked.map((row) => row.fingerprint)).size).toBe(3);
  const states = await sql<{ concept_id: string; lapses: number; days: number }>(
    "select concept_id, lapses, extract(epoch from due_at - now()) / 86400 as days from review_states order by due_at",
  );
  // The missed lesson is back within days; the recalled ones are weeks away.
  expect(states[0]).toMatchObject({ concept_id: asked[1].concept_id, lapses: 1 });
  expect(Number(states[0].days)).toBeLessThan(7);
  expect(Number(states[1].days)).toBeGreaterThan(14);
});

test("the same lesson, due again, gets a question it has never had", async ({ page }) => {
  const [{ concept_id: lesson }] = await sql<{ concept_id: string }>("select concept_id from review_states order by due_at limit 1");
  const before = await sql<{ prompt: string }>("select question->>'prompt' as prompt from review_questions where concept_id = $1", [lesson]);
  expect(before).toHaveLength(1);
  await sql("update review_states set due_at = now() - interval '1 hour', last_reviewed_at = last_reviewed_at - interval '6 days' where concept_id = $1", [lesson]);

  await page.goto("/learn");
  await expect(card(page)).toBeVisible({ timeout: 30_000 });
  const prompt = await card(page).locator(".q-prompt").innerText();
  const count = await sheep(page);
  expect(before[0].prompt).not.toContain(`has ${count} sheep`);
  expect(prompt).toContain(`has ${count} sheep`);
  await answer(page, String(count + 10));
  await expect(card(page)).toContainText("Recalled");

  const rows = await sql<{ answered: boolean }>("select answered_at is not null as answered from review_questions where concept_id = $1 order by id", [lesson]);
  expect(rows.map((row) => row.answered)).toEqual([true, true]);
  await page.getByRole("link", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "You have finished every lesson written so far." })).toBeVisible();
});
