import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}

for (const theme of ["dark", "light"] as const) {
  test(`home fits the screen and is accessible (${theme})`, async ({ page }, info) => {
    await page.addInitScript((t) => localStorage.setItem("axiom-theme", t), theme);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    const learn = page.getByRole("link", { name: /Learn/ });
    await expect(learn).toBeVisible();
    await expect(learn).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole("heading", { level: 1, name: "Derive it. Build it. Keep it." })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(theme === "dark");

    // The specification allows at most 2 px of radius on controls.
    const radius = await learn.evaluate((el) => parseFloat(getComputedStyle(el).borderTopLeftRadius));
    expect(radius).toBeLessThanOrEqual(2);
    // Touch targets are at least 40 px tall.
    expect((await learn.boundingBox())!.height).toBeGreaterThanOrEqual(40);

    await expectNoHorizontalScroll(page);
    await expectAccessible(page);
    await page.screenshot({ path: `test-results/screens/home-${info.project.name}-${theme}.png` });
  });
}

test("the headline reveal runs when motion is welcome and ends fully visible", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const lastChar = page.locator("h1 .char").last();
  await expect(lastChar).toHaveCSS("opacity", "1", { timeout: 5000 });
});

test("the theme switch works and is remembered", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Light theme" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await expect(page.getByRole("button", { name: "Dark theme" })).toBeVisible();
});

test("sign-in fits the screen and is accessible", async ({ browser }, info) => {
  const context = await browser.newContext({ viewport: info.project.use.viewport, reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/sign-in");
  await expect(page.getByLabel("Six words")).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectAccessible(page);
  await page.screenshot({ path: `test-results/screens/sign-in-${info.project.name}.png` });
  await context.close();
});

test("every screen can be reached and used with the keyboard", async ({ page }) => {
  await page.goto("/");
  const order: string[] = [];
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("Tab");
    order.push(await page.evaluate(() => document.activeElement?.textContent?.trim() ?? ""));
  }
  expect(order).toEqual(["AXIOM", "Light theme", "Sign out", "Learn›"]);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/learn$/);
});

test("the wordmark, theme switch and sign out sit on one line", async ({ page }) => {
  await page.goto("/");
  const centres = [];
  for (const item of [
    page.getByRole("link", { name: "Axiom home" }),
    page.getByRole("button", { name: /theme$/ }),
    page.getByRole("button", { name: "Sign out" }),
  ]) {
    // Measure the text itself, not the element around it.
    centres.push(
      await item.evaluate((el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        const box = range.getBoundingClientRect();
        return box.top + box.height / 2;
      }),
    );
  }
  expect(Math.max(...centres) - Math.min(...centres)).toBeLessThanOrEqual(0.5);
});

test("the workspace top bar sits on one line", async ({ page }) => {
  await page.goto("/learn");
  const centres = [];
  for (const item of [page.getByRole("link", { name: "Axiom home" }), page.getByRole("button", { name: /theme$/ })]) {
    centres.push(
      await item.evaluate((el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        const box = range.getBoundingClientRect();
        return box.top + box.height / 2;
      }),
    );
  }
  expect(Math.max(...centres) - Math.min(...centres)).toBeLessThanOrEqual(0.5);
});
