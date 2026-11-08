import { test, expect, type Page } from "./fixtures";
import { addSet, createMovement, historyRows, openPage, setRows, startWorkout, uniqueToken } from "./helpers";

// Completing a workout with no Completed Sets asks whether to save it as a Gym Visit, discard it,
// or keep logging (CONTEXT.md, Gym Visit). The helper completeWorkout doesn't fit here: it expects
// the workout to complete right away.

/** Clicks Complete Workout on a workout with no Completed Sets and waits for the question. */
async function completeEmptyWorkout(page: Page, title = "This workout has no sets") {
  await page.getByRole("button", { name: "Complete Workout" }).click();
  const dialog = page.getByRole("dialog", { name: title });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe("Completing a workout with no sets", () => {
  test("asks first, with the focus on the question and no toast", async ({ page }) => {
    await startWorkout(page);
    const answered = page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/_serverFn/"));

    const dialog = await completeEmptyWorkout(page);

    await expect(dialog).toContainText("Gym visits show in your history but not in your progress charts.");
    // No choice is the default: the focus starts on the title, so Enter presses nothing.
    await expect(dialog.getByRole("heading", { name: "This workout has no sets" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(dialog).toBeVisible();
    // Tab goes through the three choices, in the order the text gives them.
    for (const name of ["Save as gym visit", "Discard workout", "Keep logging"]) {
      await page.keyboard.press("Tab");
      await expect(dialog.getByRole("button", { name })).toBeFocused();
    }
    // The refusal opened the dialog instead of an error toast. Counted once, not with toHaveCount(0),
    // which would also pass once a toast closed by itself. By class, not role: the toast container
    // sits outside the modal dialog, in the inert page.
    await answered;
    await page.waitForTimeout(500);
    expect(await page.locator(".Toastify__toast").count()).toBe(0);
  });

  test("saves it as a gym visit, which shows in the history", async ({ page }) => {
    await startWorkout(page);
    const dialog = await completeEmptyWorkout(page);

    await dialog.getByRole("button", { name: "Save as gym visit" }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByRole("status")).toContainText("Saved as a gym visit.");
    await expect(page.getByText("No active workout")).toBeVisible();
    await page.getByRole("link", { name: "View in history" }).click();
    await expect(page.getByRole("heading", { name: "Workout History" })).toBeVisible();
    await expect(historyRows(page)).toHaveCount(1);
  });

  test("discards it, leaving no workout anywhere", async ({ page }) => {
    await startWorkout(page);
    const dialog = await completeEmptyWorkout(page);

    await dialog.getByRole("button", { name: "Discard workout" }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByRole("status")).toHaveText("Workout discarded.");
    await expect(page.getByText("No active workout")).toBeVisible();
    // Discarding was saved, not just hidden.
    await openPage(page, "/current-workout");
    await expect(page.getByText("No active workout")).toBeVisible();
    await openPage(page, "/workout-history");
    await expect(page.getByText("No completed workouts yet.")).toBeVisible();
  });

  test("keeps logging, back on the movement picker", async ({ page }) => {
    await startWorkout(page);
    const dialog = await completeEmptyWorkout(page);

    await dialog.getByRole("button", { name: "Keep logging" }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByLabel("Movement", { exact: true })).toBeFocused();
    await openPage(page, "/current-workout");
    await expect(page.getByRole("button", { name: "Complete Workout" })).toBeVisible();
  });

  test("Esc and a click outside the dialog both mean keep logging", async ({ page }) => {
    await startWorkout(page);
    const dialog = await completeEmptyWorkout(page);

    await page.keyboard.press("Escape");

    await expect(dialog).toBeHidden();
    await expect(page.getByLabel("Movement", { exact: true })).toBeFocused();

    await completeEmptyWorkout(page);
    // The scrim covers the page; its corner is far from the centered panel.
    await page.mouse.click(5, 5);

    await expect(dialog).toBeHidden();
    await expect(page.getByLabel("Movement", { exact: true })).toBeFocused();
    await expect(page.getByRole("button", { name: "Complete Workout" })).toBeVisible();
  });

  test("asks too when every set is planned", async ({ page }) => {
    const movement = `Bench Press ${uniqueToken()}`;
    await createMovement(page, movement);
    await startWorkout(page);
    await addSet(page, { movement, weight: 185, reps: 5, count: 2 });
    for (const set of [1, 2]) {
      await page.getByRole("checkbox", { name: `Completed: ${movement}, set ${set}, 185 lb × 5` }).click();
    }
    await expect(setRows(page, movement).getByRole("checkbox", { checked: false })).toHaveCount(2);

    const dialog = await completeEmptyWorkout(page, "No sets completed yet");

    await expect(dialog).toContainText("None of the 2 sets in this workout is marked as completed.");
    await dialog.getByRole("button", { name: "Save as gym visit" }).click();
    await expect(page.getByRole("status")).toContainText("Saved as a gym visit.");
    await openPage(page, "/workout-history");
    await expect(historyRows(page)).toHaveCount(1);
  });

  test("a workout with a completed set completes without asking", async ({ page }) => {
    const movement = `Deadlift ${uniqueToken()}`;
    await createMovement(page, movement);
    await startWorkout(page);
    await addSet(page, { movement, weight: 315, reps: 3 });

    await page.getByRole("button", { name: "Complete Workout" }).click();

    await expect(page.getByText("No active workout")).toBeVisible();
    expect(await page.getByRole("dialog").count()).toBe(0);
  });
});
