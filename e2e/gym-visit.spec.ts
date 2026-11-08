import { test, expect, type Page } from "./fixtures";
import {
  addSet,
  completeButton,
  completeWorkout,
  createMovement,
  deleteSelectedButton,
  historyRows,
  logCompletedWorkout,
  openPage,
  setRows,
  startWorkout,
  uniqueToken,
} from "./helpers";

// Completing a workout with no Completed Sets asks whether to save it as a Gym Visit, discard it,
// or keep logging (CONTEXT.md, Gym Visit). The helper completeWorkout only fits a workout with a
// Completed Set: it expects the workout to complete right away.

/** Adds `count` sets of the movement and unmarks each one, so they are all Planned Sets. */
async function addPlannedSets(page: Page, movement: string, count: number) {
  await addSet(page, { movement, weight: 185, reps: 5, count });
  for (let set = 1; set <= count; set++) {
    await page.getByRole("checkbox", { name: `Completed: ${movement}, set ${set}, 185 lb × 5` }).click();
  }
  await expect(setRows(page, movement).getByRole("checkbox", { checked: false })).toHaveCount(count);
}

/** Clicks Complete Workout on a workout with no Completed Sets and waits for the question. */
async function completeEmptyWorkout(page: Page, title = "This workout has no sets") {
  await completeButton(page).click();
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
    await expect(historyRows(page)).toHaveText([/Gym visit, no sets logged$/]);
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
    await expect(completeButton(page)).toBeVisible();
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
    await expect(completeButton(page)).toBeVisible();
  });

  test("asks too when every set is planned", async ({ page }) => {
    const movement = `Bench Press ${uniqueToken()}`;
    await createMovement(page, movement);
    await startWorkout(page);
    await addPlannedSets(page, movement, 2);

    const dialog = await completeEmptyWorkout(page, "No sets completed yet");

    await expect(dialog).toContainText("None of the 2 sets in this workout is marked as completed.");
    await dialog.getByRole("button", { name: "Save as gym visit" }).click();
    await expect(page.getByRole("status")).toContainText("Saved as a gym visit.");
    await openPage(page, "/workout-history");
    await expect(historyRows(page)).toHaveText([/Gym visit, 0 of 2 sets completed$/]);
  });

  test("says the set when the only set is planned", async ({ page }) => {
    const movement = `Bench Press ${uniqueToken()}`;
    await createMovement(page, movement);
    await startWorkout(page);
    await addPlannedSets(page, movement, 1);

    const dialog = await completeEmptyWorkout(page, "No sets completed yet");

    await expect(dialog).toContainText("The set in this workout isn't marked as completed.");
  });

  test("a workout with a completed set completes without asking", async ({ page }) => {
    const movement = `Deadlift ${uniqueToken()}`;
    await createMovement(page, movement);
    await startWorkout(page);
    await addSet(page, { movement, weight: 315, reps: 3 });

    await completeWorkout(page);

    expect(await page.getByRole("dialog").count()).toBe(0);
  });
});

// The page refuses from what it shows, which another tab can have changed since. A refusal reloads
// the Current Workout, so the screen catches up before it asks or explains.
test.describe("Completing after another tab changed the workout", () => {
  test("asks about the sets the other tab added", async ({ page }) => {
    const movement = `Bench Press ${uniqueToken()}`;
    await createMovement(page, movement);
    await startWorkout(page);
    const otherTab = await page.context().newPage();
    await openPage(otherTab, "/current-workout");
    await addPlannedSets(otherTab, movement, 2);

    const dialog = await completeEmptyWorkout(page, "No sets completed yet");

    await expect(dialog).toContainText("None of the 2 sets in this workout is marked as completed.");
  });

  test("a refused discard shows the set the other tab completed", async ({ page }) => {
    const movement = `Bench Press ${uniqueToken()}`;
    await createMovement(page, movement);
    await startWorkout(page);
    await addPlannedSets(page, movement, 1);
    const dialog = await completeEmptyWorkout(page, "No sets completed yet");
    const otherTab = await page.context().newPage();
    await openPage(otherTab, "/current-workout");
    await otherTab.getByRole("checkbox", { name: `Completed: ${movement}, set 1, 185 lb × 5` }).click();
    await expect(setRows(otherTab, movement).getByRole("checkbox", { checked: true })).toHaveCount(1);

    await dialog.getByRole("button", { name: "Discard workout" }).click();

    await expect(
      page.getByRole("alert").filter({ hasText: "This workout has completed sets, so it can't be discarded" }),
    ).toBeVisible();
    await expect(dialog).toBeHidden();
    await expect(setRows(page, movement).getByRole("checkbox", { checked: true })).toHaveCount(1);
  });
});

test.describe("A gym visit in the history", () => {
  /** Starts a workout and saves it, empty, as a Gym Visit. */
  async function saveGymVisit(page: Page) {
    await startWorkout(page);
    const dialog = await completeEmptyWorkout(page);
    await dialog.getByRole("button", { name: "Save as gym visit" }).click();
    await expect(page.getByRole("status")).toContainText("Saved as a gym visit.");
  }

  test("says no sets were logged, with no muscle groups and no movement columns", async ({ page }) => {
    await saveGymVisit(page);

    await openPage(page, "/workout-history");

    const [row] = await historyRows(page).all();
    // The checkbox, the date, the muscle groups, and one label across the rest.
    await expect(row.getByRole("cell")).toHaveCount(4);
    await expect(row.getByRole("cell").nth(2)).toHaveText("-");
    await expect(row.getByRole("cell").nth(3)).toHaveText("Gym visit, no sets logged");
    await expect(page.getByRole("columnheader")).toHaveText(["", "Date", "Muscle groups", "Sets"]);
  });

  test("spans the set count and every movement column", async ({ page }) => {
    const movement = `Squat ${uniqueToken()}`;
    await createMovement(page, movement);
    await saveGymVisit(page);
    await logCompletedWorkout(page, { movement, weight: 225, reps: 5 });

    await openPage(page, "/workout-history");

    await expect(historyRows(page)).toHaveText([/225 lb \/ 5 reps \/ 1 set$/, /Gym visit, no sets logged$/]);
    const visit = historyRows(page).filter({ hasText: "Gym visit" });
    await expect(visit.getByRole("cell").last()).toHaveAttribute("colspan", "2");
  });

  test("is deleted like any workout", async ({ page }) => {
    const movement = `Row ${uniqueToken()}`;
    await createMovement(page, movement);
    await logCompletedWorkout(page, { movement, weight: 135, reps: 8 });
    await saveGymVisit(page);
    await openPage(page, "/workout-history");
    await expect(historyRows(page)).toHaveCount(2);

    await historyRows(page).filter({ hasText: "Gym visit" }).getByRole("checkbox").check();
    await deleteSelectedButton(page, 1).click();

    await expect(historyRows(page)).toHaveText([/135 lb \/ 8 reps \/ 1 set$/]);
    // Deleting was saved, not just hidden.
    await openPage(page, "/workout-history");
    await expect(historyRows(page)).toHaveText([/135 lb \/ 8 reps \/ 1 set$/]);
  });
});
