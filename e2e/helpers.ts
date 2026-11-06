import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";

/** A short random token for names that must not clash with other tests running in parallel. */
export function uniqueToken() {
  return randomUUID().slice(0, 8);
}

/** A set as the Current Workout form takes it. */
export type NewSet = { movement: string; weight: number; reps: number };

/** Loads a page from the server and waits for hydration. */
export async function openPage(page: Page, path: string) {
  await page.goto(path);
  // Filling before hydration loses the input: React resets controlled fields.
  await page.waitForLoadState("networkidle");
}

/** Creates a movement from the Movements page and waits until it is listed. */
export async function createMovement(page: Page, name: string) {
  await openPage(page, "/movements");
  await page.getByLabel("Movement name").fill(name);
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: name })).toBeVisible();
}

/** Starts a workout and waits until the Current Workout page shows it. */
export async function startWorkout(page: Page) {
  await openPage(page, "/current-workout");
  await page.getByRole("button", { name: "Start Workout" }).click();
  await expect(page.getByRole("button", { name: "Complete Workout" })).toBeVisible();
}

/** Adds a set to the Current Workout, which must already be open on the page. */
export async function addSet(page: Page, set: NewSet) {
  await page.getByLabel("Movement", { exact: true }).selectOption({ label: set.movement });
  await page.getByLabel("Weight").fill(String(set.weight));
  await page.getByLabel("Reps").fill(String(set.reps));
  await page.getByRole("button", { name: "Add" }).click();
  await expect(
    page
      .getByRole("listitem")
      .filter({ hasText: set.movement })
      .filter({ hasText: `${set.reps} reps × ${set.weight} lbs` }),
  ).toBeVisible();
}

/** Completes the Current Workout, which must already be open on the page. */
export async function completeWorkout(page: Page) {
  await page.getByRole("button", { name: "Complete Workout" }).click();
  await expect(page.getByText("No active workout")).toBeVisible();
}

/** Logs one completed workout with a single set, from start to finish. */
export async function logCompletedWorkout(page: Page, set: NewSet) {
  await startWorkout(page);
  await addSet(page, set);
  await completeWorkout(page);
}

/** Signs up through the UI and waits until the signed-in layout shows. */
export async function createAccount(page: Page, email: string, password: string) {
  await openPage(page, "/create-account");
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
