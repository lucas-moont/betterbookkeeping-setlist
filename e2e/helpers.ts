import { expect, type Page } from "@playwright/test";

/** Signs up through the UI and waits until the signed-in layout shows. */
export async function createAccount(page: Page, email: string, password: string) {
  await page.goto("/create-account");
  // Filling before hydration loses the input: React resets controlled fields.
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Name").fill("E2E User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Logged in as")).toBeVisible();
}

/** Logs out from the signed-in layout and waits until the sign-in page is interactive. */
export async function signOut(page: Page) {
  await page.getByRole("link", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.waitForLoadState("networkidle");
}

/** Submits the sign-in form. The caller asserts the outcome (signed in or an error). */
export async function signIn(page: Page, email: string, password: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}
