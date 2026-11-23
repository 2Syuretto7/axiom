import { expect, test } from "@playwright/test";

/**
 * Runs against a deployed Vercel preview. Read-only: it never signs up or
 * signs in, so it is safe whatever data the preview database holds.
 */
test("the preview is healthy and connected to its database", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ ok: true });
});

test("visitors without a session are sent to sign-in", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("security headers are present", async ({ request }) => {
  const headers = (await request.get("/sign-in")).headers();
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["strict-transport-security"]).toContain("max-age");
});
