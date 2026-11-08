import { randomUUID } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
import { createAccount, signIn, signOut } from "./helpers";

// Five wrong passwords for one email from one address, within fifteen minutes, lock that pair out
// until the oldest of them is fifteen minutes old: the sixth attempt is refused before the password
// is even checked, so the right one is refused too. Each test signs up its own user, so its count
// starts at zero and no other test ever reaches the limit.

const password = "correct-horse-battery";
const refused = /^Too many sign-in attempts\. Try again in \d+ minutes?\.$/;

/** Signs up a brand-new user and leaves the browser on the sign-in page. */
async function newAccount(page: Page) {
  const email = `e2e-limit-${randomUUID()}@example.com`;
  await createAccount(page, email, password);
  await signOut(page);
  return email;
}

/** Submits the sign-in form and waits for the server's answer, so the next attempt can't overtake it. */
async function attempt(page: Page, email: string, withPassword: string) {
  const answered = page.waitForResponse(
    (response) => response.request().method() === "POST" && response.url().includes("/_serverFn/"),
  );
  await signIn(page, email, withPassword);
  await answered;
}

test.describe("Sign-in limit", () => {
  test("the sixth wrong password in fifteen minutes is refused, even the right one", async ({ page }) => {
    const email = await newAccount(page);
    for (let i = 0; i < 5; i++) {
      await attempt(page, email, "not-the-password");
      await expect(page.getByText("Invalid email or password")).toBeVisible();
    }

    await attempt(page, email, password);

    await expect(page.getByText(refused)).toBeVisible();
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  // The app trusts X-Forwarded-For only behind a proxy it was told about (TRUST_PROXY=true), and the
  // e2e app runs without one: a header the client sets can't pass each attempt off as a new address.
  test("a forged X-Forwarded-For doesn't start a new count", async ({ page }) => {
    const email = await newAccount(page);
    for (let i = 1; i <= 5; i++) {
      await page.setExtraHTTPHeaders({ "X-Forwarded-For": `203.0.113.${i}` });
      await attempt(page, email, "not-the-password");
      await expect(page.getByText("Invalid email or password")).toBeVisible();
    }

    await page.setExtraHTTPHeaders({ "X-Forwarded-For": "203.0.113.6" });
    await attempt(page, email, password);

    await expect(page.getByText(refused)).toBeVisible();
    await expect(page).toHaveURL(/\/sign-in$/);
  });
});
