import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const FIRST_RUN = 90_000; // The first run also downloads and starts Python.

async function openCode(page: Page, project: string) {
  if (project === "phone") await page.getByRole("button", { name: "Code", exact: true }).click();
}

async function withCode(page: Page, code: string) {
  await page.addInitScript((value) => localStorage.setItem("axiom-code:warm-up", value), code);
  await page.goto("/learn");
}

test("panes are arranged for this screen size", async ({ page }, info) => {
  await page.goto("/learn");
  const lesson = page.getByRole("region", { name: "Lesson" });
  const code = page.getByRole("region", { name: "Code" });
  const tabs = page.getByRole("navigation", { name: "Panes" });

  if (info.project.name === "laptop") {
    const [a, b] = [(await lesson.boundingBox())!, (await code.boundingBox())!];
    expect(a.x + a.width).toBeLessThanOrEqual(b.x); // side by side
    expect(Math.abs(a.width - b.width)).toBeLessThan(4);
    await expect(tabs).toBeHidden();
  } else if (info.project.name === "tablet") {
    const [a, b] = [(await lesson.boundingBox())!, (await code.boundingBox())!];
    expect(a.y + a.height).toBeLessThanOrEqual(b.y); // portrait: stacked
    await expect(tabs).toBeHidden();
  } else {
    await expect(lesson).toBeVisible();
    await expect(code).toBeHidden();
    await page.getByRole("button", { name: "Code", exact: true }).click();
    await expect(code).toBeVisible();
    await expect(lesson).toBeHidden();
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: `test-results/screens/workspace-${info.project.name}.png` });
});

test("tablet in landscape puts the panes side by side", async ({ page }, info) => {
  test.skip(info.project.name !== "tablet");
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.goto("/learn");
  const a = (await page.getByRole("region", { name: "Lesson" }).boundingBox())!;
  const b = (await page.getByRole("region", { name: "Code" }).boundingBox())!;
  expect(a.x + a.width).toBeLessThanOrEqual(b.x);
});

test("Python runs in the browser and prints its output", async ({ page }, info) => {
  await page.goto("/learn");
  await openCode(page, info.project.name);
  await page.getByRole("button", { name: /^Run/ }).click();
  await expect(page.getByTestId("output")).toContainText("1 + 2 + ... + 10 = 55", { timeout: FIRST_RUN });
  await page.screenshot({ path: `test-results/screens/workspace-run-${info.project.name}.png` });
});

test("errors are shown as Python reports them, about the learner's own line", async ({ page }, info) => {
  await withCode(page, "x = 10\nprint(x / 0)\n");
  await openCode(page, info.project.name);
  await page.getByRole("button", { name: /^Run/ }).click();
  const output = page.getByTestId("output");
  await expect(output).toContainText("ZeroDivisionError", { timeout: FIRST_RUN });
  await expect(output).toContainText("line 2");
  await expect(output).not.toContainText("_pyodide");
});

test("a loop that never ends can be stopped, and Python recovers", async ({ page }, info) => {
  await withCode(page, "while True:\n    pass\n");
  await openCode(page, info.project.name);
  await page.getByRole("button", { name: /^Run/ }).click();
  await page.getByRole("button", { name: "Stop" }).click();
  await expect(page.getByTestId("output")).toContainText("Stopped.");
  // The worker was replaced; a new run must still work.
  await page.locator(".cm-content").click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("print(6 * 7)");
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.getByTestId("output")).toContainText("42", { timeout: FIRST_RUN });
});

test("code is saved as it is typed and survives a reload", async ({ page }, info) => {
  await page.goto("/learn");
  await openCode(page, info.project.name);
  await page.locator(".cm-content").click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("print('kept')");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("axiom-code:warm-up"))).toBe("print('kept')");
  await page.reload();
  await openCode(page, info.project.name);
  await expect(page.locator(".cm-content")).toContainText("print('kept')");
});

test("touch screens get a symbol bar that types into the editor", async ({ page }, info) => {
  test.skip(info.project.name === "laptop");
  await withCode(page, "");
  await openCode(page, info.project.name);
  const bar = page.getByRole("toolbar", { name: "Code symbols" });
  await expect(bar).toBeVisible();
  await page.locator(".cm-content").click();
  await page.keyboard.type("print");
  for (const symbol of ["(", "[", "]", ")"]) await bar.getByRole("button", { name: symbol, exact: true }).click();
  await expect(page.locator(".cm-content")).toContainText("print([])");
  const key = (await bar.getByRole("button", { name: "(", exact: true }).boundingBox())!;
  expect(key.height).toBeGreaterThanOrEqual(40);
});

test("the workspace is accessible", async ({ page }, info) => {
  await page.goto("/learn");
  await openCode(page, info.project.name);
  // CodeMirror's scroller wraps an editable text box that is itself focusable
  // and scrolls with the cursor, which the automated rule cannot see.
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .exclude(".cm-scroller")
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes[0]?.target})`)).toEqual([]);
});
