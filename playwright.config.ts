import { defineConfig } from "@playwright/test";

/**
 * Two modes.
 * Local and CI: builds the app, runs it against a throwaway Postgres database
 * and exercises the full flows at laptop, tablet and phone sizes.
 * Live (LIVE_URL set): read-only smoke check of the deployed production site.
 * See tests/e2e/live.spec.ts. No secrets are involved in either mode.
 */
const previewUrl = process.env.LIVE_URL;
const port = 3100;
const e2eDatabase = process.env.E2E_DATABASE_URL ?? "postgres://axiom:axiom@localhost:5432/axiom_e2e";

const sizes = {
  laptop: { width: 1440, height: 900 },
  tablet: { width: 820, height: 1180 },
  phone: { width: 390, height: 844 },
} as const;

export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "test-results",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: previewUrl ?? `http://localhost:${port}`,
    trace: "off",
  },
  projects: previewUrl
    ? Object.entries(sizes).map(([name, viewport]) => ({
        name: `live-${name}`,
        testMatch: /live\.spec\.ts/,
        use: { viewport, hasTouch: name !== "laptop" },
      }))
    : [
        { name: "flow", testMatch: /flow\.spec\.ts/, use: { viewport: sizes.laptop } },
        ...Object.entries(sizes).map(([name, viewport]) => ({
          name,
          testMatch: /(layout|workspace)\.spec\.ts/,
          dependencies: ["flow"],
          use: { viewport, hasTouch: name !== "laptop", storageState: "test-results/.auth/learner.json" },
        })),
      ],
  webServer: previewUrl
    ? undefined
    : {
        command: `npm run build && npm run start -- --port ${port}`,
        url: `http://localhost:${port}/api/health`,
        timeout: 240_000,
        reuseExistingServer: false,
        env: { DATABASE_URL: e2eDatabase },
      },
  globalSetup: previewUrl ? undefined : "./tests/e2e/global-setup.ts",
});
