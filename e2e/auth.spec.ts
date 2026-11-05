import { test, expect } from "@playwright/test";
import { createAccount, signIn, signOut } from "./helpers";

test.describe("Auth", () => {
  test("a new account can sign out and sign back in with the same password", async ({ page }) => {
    const email = `e2e-auth-${Date.now()}@example.com`;
    await createAccount(page, email, "correct-horse-battery");
    await signOut(page);

    await signIn(page, email, "correct-horse-battery");

    await expect(page.getByText("Logged in as")).toBeVisible();
  });

  test("signing in with the wrong password is rejected", async ({ page }) => {
    const email = `e2e-auth-wrong-${Date.now()}@example.com`;
    await createAccount(page, email, "correct-horse-battery");
    await signOut(page);

    await signIn(page, email, "not-the-password");

    await expect(page.getByText("Invalid email or password")).toBeVisible();
    await expect(page).toHaveURL(/\/sign-in$/);
  });
});
