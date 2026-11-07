import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";

/** A short random token for names that must not clash with other tests running in parallel. */
export function uniqueToken() {
  return randomUUID().slice(0, 8);
}

/** A set as the Current Workout form takes it. `count` identical sets are added at once (1 by default). */
export type NewSet = { movement: string; weight: number; reps: number; count?: number };

/** Loads a page from the server and waits for hydration. Returns the server's response. */
export async function openPage(page: Page, path: string) {
  const response = await page.goto(path);
  // Filling before hydration loses the input: React resets controlled fields.
  await page.waitForLoadState("networkidle");
  return response;
}

/** What the new movement form takes besides the name: a muscle group label and the body-weight flag. */
export type NewMovementOptions = { muscleGroup?: string; bodyWeight?: boolean };

/** Creates a movement from the Movements page and waits until it is listed. */
export async function createMovement(page: Page, name: string, { muscleGroup, bodyWeight }: NewMovementOptions = {}) {
  await openPage(page, "/movements");
  await page.getByLabel("Movement name").fill(name);
  if (muscleGroup) await page.getByLabel("Muscle group", { exact: true }).selectOption({ label: muscleGroup });
  if (bodyWeight) await page.getByLabel("Body-weight").check();
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: name })).toBeVisible();
}

/** Records a body weight from the Profile, which must already be open, on the form's date (today unless the test picked one). */
export async function recordBodyWeight(page: Page, weight: number) {
  await page.getByLabel("Weight in pounds").fill(String(weight));
  await page.getByRole("button", { name: /^(Record|Replace)$/ }).click();
  await expect(page.getByRole("status")).toContainText(/^(Recorded|Replaced)/);
}

/** Starts a workout and waits until the Current Workout page shows it. */
export async function startWorkout(page: Page) {
  await openPage(page, "/current-workout");
  await page.getByRole("button", { name: "Start Workout" }).click();
  await expect(page.getByRole("button", { name: "Complete Workout" })).toBeVisible();
}

/** The Current Workout's Add button, which reads "Add" or "Add 3 sets", and nothing else that starts with Add. */
export function addSetButton(page: Page) {
  return page.getByRole("button", { name: /^Add( \d+ sets)?$/ });
}

/** The rows of one Movement's sets in the Current Workout, in the order they were added. */
export function setRows(page: Page, movement: string) {
  return page.getByRole("region", { name: movement, exact: true }).getByRole("listitem");
}

/** Adds a set (or `count` identical sets) to the Current Workout, which must already be open on the page. */
export async function addSet(page: Page, set: NewSet) {
  const count = set.count ?? 1;
  const rows = setRows(page, set.movement);
  const before = await rows.count();
  await page.getByLabel("Movement", { exact: true }).selectOption({ label: set.movement });
  await page.getByLabel("Weight", { exact: true }).fill(String(set.weight));
  await page.getByLabel("Reps").fill(String(set.reps));
  await page.getByLabel("Number of sets").fill(String(count));
  await addSetButton(page).click();
  await expect(rows).toHaveCount(before + count);
  await expect(rows.last()).toContainText(`${set.reps} reps × ${set.weight} lb`);
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

/** Signs up a brand-new user through the UI, so the test owns all of its data (ADR 0008). */
export async function signUpAsNewUser(page: Page) {
  await createAccount(page, `e2e-${randomUUID()}@example.com`, "correct-horse-battery");
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
