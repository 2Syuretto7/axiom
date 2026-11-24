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

  // Figures are live drawings with real controls and a text reading of their state.
  const line = page.getByRole("figure").filter({ hasText: "Number line" });
  await line.getByRole("button", { name: "Step right" }).click();
  await line.getByRole("button", { name: "Step right" }).click();
  await expect(line).toContainText("Started at 1, moved 2 steps right, now at 2.");
  const grid = page.getByRole("figure").filter({ hasText: "Multiplication as area" });
  await expect(grid).toContainText("3 × 12 = 3 × 10 + 3 × 2 = 30 + 6 = 36");
  await grid.getByRole("button", { name: "Increase rows" }).click();
  await expect(grid).toContainText("4 × 12 = 4 × 10 + 4 × 2 = 40 + 8 = 48");
  // The coordinate plane: a point, a line, two lines meeting, and a parabola.
  const point = page.getByRole("figure").filter({ hasText: "Coordinates" });
  await expect(point).toContainText("The point (3, 2): 3 right, 2 up. It is in quadrant I. Distance from the origin: √13 ≈ 3.61.");
  for (let i = 0; i < 4; i++) await point.getByRole("button", { name: "Decrease x" }).click();
  await point.getByRole("button", { name: "Decrease y" }).click();
  await point.getByRole("button", { name: "Decrease y" }).click();
  await expect(point).toContainText("The point (−1, 0): 1 left, neither up nor down. It lies on the x-axis. Distance from the origin: 1.");
  const straight = page.getByRole("figure").filter({ hasText: "Straight line" });
  await expect(straight).toContainText("y = 2x + 1. It crosses the y-axis at 1. For each 1 step to the right it goes up 2.");
  await straight.getByRole("slider", { name: "slope" }).fill("-0.5");
  await straight.getByRole("slider", { name: "intercept" }).fill("0");
  await expect(straight).toContainText("y = −0.5x. It crosses the y-axis at 0. For each 1 step to the right it goes down 0.5.");
  const pair = page.getByRole("figure").filter({ hasText: "Two lines" });
  await expect(pair).toContainText("y = x + 1 and y = −x + 5. They cross at (2, 3), the only pair that satisfies both equations.");
  await pair.getByRole("slider", { name: "slope" }).fill("-1");
  await expect(pair).toContainText("They are parallel and never meet");
  await pair.getByRole("slider", { name: "intercept" }).fill("5");
  await expect(pair).toContainText("They are the same line");
  const curve = page.getByRole("figure").filter({ hasText: "Parabola" });
  await expect(curve).toContainText("y = x² − 2x − 3. It opens upwards, with its turning point at (1, −4). It crosses the x-axis at −1 and 3. b² − 4ac = 16.");
  await curve.getByRole("slider", { name: "c" }).fill("1");
  await expect(curve).toContainText("It touches the x-axis at 1.");
  await curve.getByRole("slider", { name: "c" }).fill("4");
  await expect(curve).toContainText("It never meets the x-axis. b² − 4ac = −12.");
  // Sets, maps, inverses, growth, the unit circle, and sums.
  const venn = page.getByRole("figure").filter({ hasText: "Two sets" });
  await expect(venn).toContainText("In both (A ∩ B): 6, 12.");
  await expect(venn).toContainText("In A but not B (A ∖ B): 2, 4, 8, 10. In neither: 1, 5, 7, 11.");
  await venn.getByRole("button", { name: "Increase B: multiples of" }).click();
  await expect(venn).toContainText("In both (A ∩ B): 4, 8, 12.");
  const arrows = page.getByRole("figure").filter({ hasText: "Arrow diagram" });
  await expect(arrows).toContainText("f(x) = 2x mod m with m = 6");
  await expect(arrows).toContainText("Injective: no, inputs 0 and 3 share the output 0. Surjective: no, nothing reaches 1, 3, 5. This map is neither.");
  await arrows.getByRole("button", { name: "Decrease rule" }).click();
  await expect(arrows).toContainText("Injective: yes, no output is hit twice. Surjective: yes, every output is hit. This map is a bijection.");
  await arrows.getByRole("button", { name: "Decrease outputs (m)" }).click();
  await expect(arrows).toContainText("Injective: no, inputs 0 and 5 share the output 1. Surjective: yes");
  const inverse = page.getByRole("figure").filter({ hasText: "A function and its inverse" });
  await expect(inverse).toContainText("f(x) = 2x − 2. Its inverse is g(x) = 0.5x + 1. f sends 3 to 4, and g sends 4 back to 3");
  await inverse.getByRole("slider", { name: "slope" }).fill("0");
  await expect(inverse).toContainText("there is no inverse");
  const growth = page.getByRole("figure").filter({ hasText: "Compound growth" });
  await expect(growth).toContainText("1 step, each multiplying by (1 + 1/1). After one year: ₹2.00000.");
  await growth.getByRole("button", { name: "Increase how often" }).click();
  await expect(growth).toContainText("every half-year: 2 steps");
  await expect(growth).toContainText("After one year: ₹2.25000.");
  for (let i = 0; i < 4; i++) await growth.getByRole("button", { name: "Increase how often" }).click();
  await expect(growth).toContainText("every day: 365 steps, each multiplying by (1 + 1/365). After one year: ₹2.71457.");
  const circle = page.getByRole("figure").filter({ hasText: "Unit circle" });
  await expect(circle).toContainText("Angle 30° = π/6 radians. The point on the circle is (cos, sin) = (√3/2 ≈ 0.866, 1/2 ≈ 0.5). Check: cos² + sin² = 1.");
  await circle.getByRole("slider", { name: "angle" }).fill("14");
  await expect(circle).toContainText("Angle 210° = 7π/6 radians. The point on the circle is (cos, sin) = (−√3/2 ≈ −0.866, −1/2 ≈ −0.5).");
  await circle.getByRole("slider", { name: "angle" }).fill("6");
  await expect(circle).toContainText("Angle 90° = π/2 radians. The point on the circle is (cos, sin) = (0, 1).");
  const stairs = page.getByRole("figure").filter({ hasText: "Sum of the first n whole numbers" });
  await expect(stairs).toContainText("4 × 5 ÷ 2 = 10");
  for (let i = 0; i < 6; i++) await stairs.getByRole("button", { name: "Increase n" }).click();
  await expect(stairs).toContainText("1 + 2 + … + 10 is the blue staircase: 55 squares.");
  const series = page.getByRole("figure").filter({ hasText: "Partial sums of a geometric series" });
  await expect(series).toContainText("r = 0.5. The sum of the first 6 terms is 1.97. The totals close in on 1 ÷ (1 − r) = 2: the series converges.");
  await series.getByRole("slider", { name: "ratio r" }).fill("1");
  await expect(series).toContainText("The sum of the first 6 terms is 6. The ratio is not smaller than 1 in size, so the totals never settle: the series diverges.");
  const stack = page.getByRole("figure").filter({ hasText: "The call stack" });
  await expect(stack).toContainText("Step 0: factorial(3) has been called. 3 is not 0, so it needs factorial(2) and must wait. 1 call is on the stack.");
  for (let i = 0; i < 3; i++) await stack.getByRole("button", { name: "Increase step" }).click();
  await expect(stack).toContainText("Step 3: factorial(0) has been called. It is the base case and returns 1 without calling anything. 4 calls are on the stack, the deepest it gets.");
  for (let i = 0; i < 3; i++) await stack.getByRole("button", { name: "Increase step" }).click();
  await expect(stack).toContainText("Step 6: factorial(2) returned 2. factorial(3) resumes with its own n = 3 and computes 3 × 2 = 6. 1 call is on the stack.");
  await stack.getByRole("button", { name: "Increase step" }).click();
  await expect(stack).toContainText("Step 7: factorial(3) returned 6. The stack is empty. 4 calls were made in all.");
  await expect(stack.getByRole("button", { name: "Increase step" })).toBeDisabled();
  await stack.getByRole("button", { name: "Increase n" }).click();
  await expect(stack).toContainText("Step 0: factorial(4) has been called.");
  const rates = page.getByRole("figure").filter({ hasText: "How running times grow" });
  await expect(rates).toContainText("For an input of size n = 8: log₂ n = 3 steps, n = 8, n log₂ n = 24, n² = 64, 2ⁿ = 256.");
  await rates.getByRole("slider", { name: "size n" }).fill("16");
  await expect(rates).toContainText("For an input of size n = 16: log₂ n = 4 steps, n = 16, n log₂ n = 64, n² = 256, 2ⁿ = 65,536.");
  await expect(page.locator(".prose-lesson img")).toHaveCount(0);

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
