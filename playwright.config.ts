import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // Technical debt until Vite 8: warms up the dev server first. See the comment in the file.
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  // The same specs at two widths. "phone" is an iPhone SE's screen (375×667) in Chromium, below the
  // md breakpoint, so the bottom bar replaces the sidebar (DESIGN.md, Layout). The helpers find the
  // controls at either width. Tests tagged @desktop check the sidebar itself and only run on
  // "chromium"; the phone layout's own tests set their size and run on both.
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "phone",
      use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true },
      grepInvert: /@desktop/,
    },
  ],
});
