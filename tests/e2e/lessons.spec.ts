import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// One learner works through the three fixture lessons in order, so these run in sequence.
test.describe.configure({ mode: "serial" });

const FIRST_RUN = 90_000;
const question = (page: Page, n: number) => page.getByRole("region", { name: `Question ${n}`, exact: true });

async function answerNumber(page: Page, n: number, value: string) {
  const q = question(page, n);
  await q.getByRole("textbox").fill(value);
  await q.getByRole("button", { name: "Check" }).click();
}

async function replaceCode(page: Page, code: string) {
  await page.locator(".cm-content").click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type(code);
}

test("laptop: a lesson is graded, remembers progress, and leads to one that builds on it", async ({ page }) => {
  await page.goto("/learn");
  await expect(page.getByRole("heading", { level: 1, name: "Counting" })).toBeVisible();
  await expect(page.getByText("0 of 3 questions solved")).toBeVisible();
  await expect(page.locator(".katex").first()).toBeVisible();
  // A concept named in the text shows its title, never its id.
  await expect(page.getByRole("region", { name: "Intuition" })).toContainText("Next comes Adding");

  // Wrong, then a hint, then right. Fractions and words are handled by the grader.
  await answerNumber(page, 1, "8");
  await expect(question(page, 1)).toContainText("Not yet");
  await question(page, 1).getByRole("button", { name: /^Hint/ }).click();
  await expect(question(page, 1)).toContainText("Each returning sheep removes exactly one pebble.");
  await expect(question(page, 1)).not.toContainText("12 - 3");
  await answerNumber(page, 1, "18/2");
  await expect(question(page, 1)).toContainText("Solved");
  await expect(question(page, 1).locator(".q-explanation")).toBeVisible();

  await question(page, 2).getByText("11", { exact: true }).click();
  await question(page, 2).getByRole("button", { name: "Check" }).click();
  await expect(question(page, 2)).toContainText("Solved");

  // Progress is on the account, not only on the page.
  await page.reload();
  await expect(page.getByText("2 of 3 questions solved")).toBeVisible();
  await expect(question(page, 1)).toContainText("Solved");

  // Put the steps in order with the move buttons.
  const wanted = ["Touch a stone", "Repeat until", "The last number"];
  const q3 = question(page, 3);
  for (let target = 0; target < wanted.length; target++) {
    for (;;) {
      const texts = await q3.locator(".q-step-text").allInnerTexts();
      const at = texts.findIndex((text) => text.startsWith(wanted[target]));
      if (at === target) break;
      await q3.getByRole("button", { name: `Move step ${at + 1} up` }).click();
    }
  }
  await q3.getByRole("button", { name: "Check" }).click();
  await expect(page.getByText("Lesson complete.")).toBeVisible();

  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).exclude(".cm-scroller").analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes[0]?.target})`)).toEqual([]);
  await page.screenshot({ path: "test-results/screens/lesson-laptop.png" });

  await page.getByRole("link", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Adding" })).toBeVisible();
  await expect(page.getByText("Builds on Counting")).toBeVisible();
});

test("tablet: the next lesson is in the same track and then crosses to another", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto("/learn");
  await expect(page.getByRole("heading", { level: 1, name: "Adding" })).toBeVisible();
  await answerNumber(page, 1, "7");
  await answerNumber(page, 2, "12");
  await expect(page.getByText("Lesson complete.")).toBeVisible();
  await page.screenshot({ path: "test-results/screens/lesson-tablet.png" });
  await page.getByRole("link", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Printing" })).toBeVisible();
  await expect(page.getByText("Builds on Adding")).toBeVisible();
  await expect(page.getByRole("list", { name: "Where you are" })).toContainText("Engineering");
});

test("phone: code is read, written, checked by hidden tests and fixed", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/learn");
  const lessonTab = page.getByRole("button", { name: "Lesson", exact: true });
  const output = page.getByTestId("output");

  // Reading code: predict exactly what it prints.
  await question(page, 1).getByRole("textbox").fill("7\n7");
  await question(page, 1).getByRole("button", { name: "Check" }).click();
  await expect(question(page, 1)).toContainText("Not yet");
  await question(page, 1).getByRole("textbox").fill("7\na + 5");
  await question(page, 1).getByRole("button", { name: "Check" }).click();
  await expect(question(page, 1)).toContainText("Solved");
  await question(page, 2).getByRole("textbox").fill("2");
  await question(page, 2).getByRole("button", { name: "Check" }).click();
  await expect(question(page, 2)).toContainText("Solved");

  // Writing code: the starter fails with a message that does not give the answer.
  await question(page, 3).getByRole("button", { name: "Open in the editor" }).click();
  await expect(page.getByTestId("doc-name")).toHaveText("Question 3");
  await expect(page.locator(".cm-content")).toContainText("total = 0");
  await page.getByRole("button", { name: /^Check/ }).click();
  await expect(output).toContainText("total is not the sum of 19 and 23 yet", { timeout: FIRST_RUN });
  await expect(output).not.toContainText("42");
  await replaceCode(page, "total = 19 + 23\nprint(total)");
  await page.getByRole("button", { name: /^Check/ }).click();
  await expect(output).toContainText("All checks passed.");
  await page.screenshot({ path: "test-results/screens/lesson-phone-code.png" });
  await lessonTab.click();
  await expect(question(page, 3)).toContainText("Solved");

  // A crash in the learner's own code shows their line, not the checker's internals.
  await question(page, 4).getByRole("button", { name: "Open in the editor" }).click();
  await replaceCode(page, "print(pebble)");
  await page.getByRole("button", { name: /^Check/ }).click();
  await expect(output).toContainText("NameError");
  await expect(output).toContainText("line 1");
  await replaceCode(page, 'print("pebble")');
  await page.getByRole("button", { name: /^Check/ }).click();
  await expect(output).toContainText("All checks passed.");

  // Finding a bug: the broken code is loaded, and each question keeps its own code.
  await lessonTab.click();
  await question(page, 5).getByRole("button", { name: "Open the broken code" }).click();
  await expect(page.locator(".cm-content")).toContainText('print("4 + 5")');
  await replaceCode(page, "print(4 + 5)");
  await page.getByRole("button", { name: /^Check/ }).click();
  await expect(output).toContainText("All checks passed.");
  await lessonTab.click();
  await expect(page.getByText("Lesson complete.")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: "test-results/screens/lesson-phone.png" });

  await page.getByRole("link", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "You have finished every lesson written so far." })).toBeVisible();
});
