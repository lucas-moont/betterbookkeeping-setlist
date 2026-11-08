import { test, expect } from "@playwright/test";
import { createAccount, mainNav, openPage, signIn, signOut, signUpAsNewUser } from "./helpers";

test.describe("Auth", () => {
  test("a new account can sign out and sign back in with the same password", async ({ page }) => {
    const email = `e2e-auth-${Date.now()}@example.com`;
    await createAccount(page, email, "correct-horse-battery");
    await signOut(page);

    await signIn(page, email, "correct-horse-battery");

    await expect(mainNav(page)).toBeVisible();
  });

  test("signing in with the wrong password is rejected", async ({ page }) => {
    const email = `e2e-auth-wrong-${Date.now()}@example.com`;
    await createAccount(page, email, "correct-horse-battery");
    await signOut(page);

    await signIn(page, email, "not-the-password");

    await expect(page.getByText("Invalid email or password")).toBeVisible();
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  // Signing out deletes the session on the server, not only the browser's cookie, so a copy of the
  // cookie taken before (another tab, a stolen value) signs nobody in afterwards.
  test("a copied session cookie stops working after sign-out", async ({ page }) => {
    await signUpAsNewUser(page);
    const copied = (await page.context().cookies()).find((cookie) => cookie.name === "session");
    expect(copied).toBeDefined();

    await signOut(page);
    await page.context().addCookies([copied!]);
    expect((await page.context().cookies()).find((cookie) => cookie.name === "session")?.value).toBe(copied!.value);

    await openPage(page, "/current-workout");

    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });
});
