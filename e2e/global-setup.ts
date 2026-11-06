import { randomUUID } from "node:crypto";
import { chromium, type FullConfig } from "@playwright/test";
import { createAccount, openPage } from "./helpers";

/**
 * Warms up the dev server before the parallel workers start.
 *
 * Technical debt, accepted for the delivery deadline. Vite 7's SSR module runner can hand a
 * module's half-evaluated exports to a second request that arrives while the first one is still
 * loading it (https://github.com/vitejs/vite/pull/22369). Right after the dev server starts,
 * parallel sign-ups then get `undefined` instead of a server function, and the page shows
 * "action is not a function". The fix shipped in Vite 8.0.12 and was not backported to 7.x
 * (https://github.com/vitejs/vite/blob/v7/packages/vite/CHANGELOG.md). The production build
 * the CI tests against is not affected.
 *
 * Signing up once and opening every signed-in page loads each server function module one at a
 * time. Delete this file and `globalSetup` in `playwright.config.ts` after upgrading to
 * Vite >= 8.0.12.
 */
export default async function globalSetup(config: FullConfig) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ baseURL: config.projects[0].use.baseURL });
    // Loads the auth server functions, then the Current Workout loader after the redirect.
    await createAccount(page, `e2e-warm-up-${randomUUID()}@example.com`, "correct-horse-battery");
    for (const path of ["/current-workout", "/movements", "/workout-history"]) {
      await openPage(page, path);
    }
  } finally {
    await browser.close();
  }
}
