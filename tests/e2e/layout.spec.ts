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
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press("Tab");
    order.push(await page.evaluate(() => document.activeElement?.textContent?.trim() ?? ""));
  }
  expect(order).toEqual(["AXIOM", "Map", "Light theme", "Sign out", "Learn›"]);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/learn$/);
});

test("the wordmark, map link, theme switch and sign out sit on one line", async ({ page }) => {
  await page.goto("/");
  const centres = [];
  for (const item of [
    page.getByRole("link", { name: "Axiom home" }),
    page.getByRole("link", { name: "Map", exact: true }),
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

test("the workspace top bar sits on one line", async ({ page }, info) => {
  await page.goto("/learn");
  // Nothing in the bar wraps, and the save status only appears where there is room for it.
  const theme = page.getByRole("button", { name: /theme$/ });
  const textHeight = await theme.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    return range.getBoundingClientRect().height;
  });
  expect(textHeight).toBeLessThanOrEqual(20); // one line of 16 px text
  if (info.project.name === "phone") await expect(page.getByRole("status").filter({ hasText: /^Sav/ })).toBeHidden();
  const centres = [];
  const items = [
    page.getByRole("link", { name: "Axiom home" }),
    page.getByRole("link", { name: "Map", exact: true }),
    page.getByRole("button", { name: /theme$/ }),
    page.getByRole("button", { name: "Sign out" }),
  ];
  if (info.project.name !== "phone") items.push(page.getByRole("status").filter({ hasText: /^Sav/ }));
  for (const item of items) {
    await expect(item).toBeVisible();
    await expect(item).toBeInViewport({ ratio: 1 });
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

for (const theme of ["dark", "light"] as const) {
  test(`the map shows every cluster, where the learner is, and the order Learn follows (${theme})`, async ({ page }, info) => {
    await page.addInitScript((t) => localStorage.setItem("axiom-theme", t), theme);
    await page.goto("/");
    await page.getByRole("link", { name: "Map", exact: true }).click();
    await expect(page).toHaveURL(/\/map$/);
    await expect(page.getByRole("heading", { level: 1, name: "Where you are, and what it leads to" })).toBeVisible();
    await expect(page.getByText("0 of 3 written lessons done. 1 more is planned. Learn will give you Counting now.")).toBeVisible();

    // The cluster the learner is in is selected to begin with.
    const panel = page.getByRole("region", { name: "Selected cluster" });
    await expect(page.getByRole("button", { name: "M0 Counting, you are here" })).toHaveAttribute("aria-pressed", "true");
    await expect(panel).toContainText("Needs Nothing. This is where everything starts.");
    await expect(panel).toContainText("Opens E0 First programs");
    await expect(panel.getByRole("listitem")).toHaveText(["CountingNow", "AddingWritten"]);

    // Any cluster can be looked at, written or not.
    const planned = page.getByRole("button", { name: "L1 Not written yet, planned, not written yet" });
    await planned.click();
    await expect(planned).toHaveAttribute("aria-pressed", "true");
    await expect(panel).toContainText("Needs E0 First programs");
    await expect(panel.getByRole("listitem")).toHaveText(["LaterPlanned"]);
    expect((await planned.boundingBox())!.height).toBeGreaterThanOrEqual(40);

    // The path is the order Learn takes, which is what each lesson's Next line shows.
    const path = page.getByRole("region", { name: "The order Learn follows" });
    await expect(path.getByRole("listitem")).toHaveText(["M0CountingNow", "M0Adding", "E0Printing"]);

    await expectNoHorizontalScroll(page);
    await expectAccessible(page);
    await page.screenshot({ path: `test-results/screens/map-${info.project.name}-${theme}.png`, fullPage: true });
    await page.getByRole("link", { name: /Learn/ }).click();
    await expect(page).toHaveURL(/\/learn$/);
  });
}
