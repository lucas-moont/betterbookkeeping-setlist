import { test as base } from "@playwright/test";
import { signUpAsNewUser } from "./helpers";

/**
 * `page` starts signed in as a brand-new user, so every test owns its data and
 * tests can run in parallel without cleanup (the same rule as ADR 0008).
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await signUpAsNewUser(page);
    await use(page);
  },
});

export { expect, type Page } from "@playwright/test";
