import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// The Anthropic API is replaced by tests/e2e/mock-anthropic.mjs, so no key is needed and nothing is spent.
const MOCK = "http://localhost:3199";

/** Opens the tutor the way this screen size offers it: a tab on a phone, a button in the top bar otherwise. */
async function openTutor(page: Page, project: string) {
  if (project === "phone") await page.getByRole("navigation", { name: "Panes" }).getByRole("button", { name: "Tutor" }).click();
  else await page.getByRole("banner").getByRole("button", { name: "Tutor" }).click();
  const tutor = page.getByRole("complementary", { name: "Tutor" });
  await expect(tutor).toBeVisible();
  // Each screen size starts from an empty conversation.
  const clear = tutor.getByRole("button", { name: "Clear" });
  if (await clear.isVisible()) await clear.click();
  await expect(tutor.getByText("Ask about anything in this lesson.")).toBeVisible();
  return tutor;
}

test("the tutor answers beside the lesson, knows the lesson and the editor, and remembers the conversation", async ({ page, request }, info) => {
  await page.addInitScript(() => localStorage.setItem("axiom-code:m0.counting", "pebbles = 12\nprint(pebbles - 3)\n"));
  await page.goto("/learn");
  const tutor = await openTutor(page, info.project.name);

  const lesson = page.getByRole("region", { name: "Lesson" });
  if (info.project.name === "phone") {
    await expect(lesson).toBeHidden(); // one pane at a time
  } else {
    // The lesson and the code stay on screen, with the tutor to their right.
    const code = page.getByRole("region", { name: "Code" });
    await expect(lesson).toBeVisible();
    await expect(code).toBeVisible();
    const [a, b, c] = [(await lesson.boundingBox())!, (await code.boundingBox())!, (await tutor.boundingBox())!];
    expect(Math.max(a.x + a.width, b.x + b.width)).toBeLessThanOrEqual(c.x + 1);
  }

  const box = tutor.getByRole("textbox", { name: "Ask the tutor" });
  await box.fill("Why do the pebbles work?");
  await tutor.getByRole("button", { name: "Ask", exact: true }).click();

  const talk = tutor.getByRole("list", { name: "Conversation with the tutor" });
  await expect(talk.getByRole("listitem")).toHaveCount(2);
  await expect(talk.getByRole("listitem").first()).toContainText("Why do the pebbles work?");
  const reply = talk.getByRole("listitem").last();
  await expect(reply).toContainText("do the pebbles left over stand for?");
  // Markdown and mathematics are rendered; HTML in a reply is shown as text, never run.
  await expect(reply.locator("strong")).toHaveText("pebbles");
  await expect(reply.locator(".katex").first()).toBeVisible();
  await expect(reply.locator("b")).toHaveCount(0);
  await expect(reply).toContainText("<b>What</b>");
  await expect(box).toHaveValue("");
  await expect(tutor.getByTestId("tutor-budget")).toHaveText(/USD 0\.(?!00)\d\d of 20\.00 used this month/i);

  // What the model was sent: the teaching style, the learner's place in the curriculum, the lesson, and the editor.
  const sent = (await (await request.get(`${MOCK}/last`)).json()) as {
    url: string;
    body: { model: string; system: { text: string; cache_control?: unknown }[]; messages: { role: string; content: string }[]; fallbacks: string };
  };
  expect(sent.url).toContain("/v1/messages");
  expect(sent.body.model).toBe("claude-opus-5-5");
  const system = sent.body.system[0];
  expect(system.cache_control).toEqual({ type: "ephemeral", ttl: "1h" });
  expect(system.text).toContain("Feynman");
  expect(system.text).toContain("Lesson: Counting");
  expect(system.text).toContain("Comes next: Adding");
  expect(system.text).toContain("A shepherd has no words for numbers.");
  const asked = sent.body.messages.at(-1)!;
  expect(asked.role).toBe("user");
  expect(asked.content).toContain("print(pebbles - 3)");
  expect(asked.content).toContain("No questions solved yet, of 3.");
  expect(asked.content.endsWith("Why do the pebbles work?")).toBe(true);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const audit = await new AxeBuilder({ page }).include(".ws-tutor").analyze();
  expect(audit.violations.map((v) => v.id)).toEqual([]);
  await page.screenshot({ path: `test-results/screens/tutor-${info.project.name}.png` });

  // The conversation is kept with the account, and a wide screen remembers that the tutor was open.
  await page.reload();
  if (info.project.name === "phone") await page.getByRole("navigation", { name: "Panes" }).getByRole("button", { name: "Tutor" }).click();
  const again = page.getByRole("complementary", { name: "Tutor" });
  await expect(again.getByRole("list", { name: "Conversation with the tutor" }).getByRole("listitem")).toHaveCount(2);
  await expect(again).toContainText("do the pebbles left over stand for?");

  // A second question carries the first exchange with it.
  await again.getByRole("textbox", { name: "Ask the tutor" }).fill("And if four are left?");
  await again.getByRole("textbox", { name: "Ask the tutor" }).press("Enter");
  await expect(again.getByRole("list", { name: "Conversation with the tutor" }).getByRole("listitem")).toHaveCount(4);
  await expect(again.getByRole("button", { name: "Ask", exact: true })).toBeVisible();
  const second = (await (await request.get(`${MOCK}/last`)).json()) as { body: { messages: { role: string; content: string }[] } };
  expect(second.body.messages.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
  expect(second.body.messages[0].content).toBe("Why do the pebbles work?");

  // Closing it gives the room back to the lesson and the code.
  if (info.project.name !== "phone") {
    await again.getByRole("button", { name: "Close" }).click();
    await expect(again).toBeHidden();
    await expect(page.getByRole("banner").getByRole("button", { name: "Tutor" })).toHaveAttribute("aria-pressed", "false");
  }
});

test("the tutor refuses politely when signed out", async ({ playwright, baseURL }) => {
  const anonymous = await playwright.request.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  const response = await anonymous.post("/api/tutor", { data: { conceptId: "m0.counting", message: "Hello" }, maxRedirects: 0 });
  expect(response.status()).toBeGreaterThanOrEqual(300);
  expect(response.status()).toBeLessThan(500);
  expect(await response.text()).not.toContain("pebbles");
  await anonymous.dispose();
});
