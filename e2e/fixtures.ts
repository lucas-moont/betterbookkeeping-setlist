import { test as base, type Page } from "@playwright/test";
import { signUpAsNewUser } from "./helpers";

/**
 * `page` starts signed in as a brand-new user, so every test owns its data and
 * tests can run in parallel without cleanup (the same rule as ADR 0008).
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await hideDevtools(page);
    await signUpAsNewUser(page);
    await use(page);
  },
});

/**
 * The dev server shows the TanStack devtools button in the bottom-left corner, which on a phone sits
 * on the bottom bar's first tab and takes its clicks. It isn't part of the app, so the tests hide it:
 * with an adopted stylesheet, which leaves the DOM React hydrates untouched.
 */
async function hideDevtools(page: Page) {
  await page.addInitScript(() => {
    const hide = () => {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync('[data-testid="tanstack_devtools"] { display: none !important; }');
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", hide);
    else hide();
  });
}

export { expect, type Locator, type Page } from "@playwright/test";
