import { test, expect, type Page } from "./fixtures";
import {
  addSet,
  completeWorkout,
  createMovement,
  logCompletedWorkout,
  openPage,
  startWorkout,
  uniqueToken,
} from "./helpers";

// Written out here rather than imported from src/lib/format.ts, so the test doesn't check the code
// against itself: "Saturday, November 7, 2026".
function longDate(instant: Date, timeZone: string) {
  const options = { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone } as const;
  return new Intl.DateTimeFormat("en-US", options).format(instant);
}

/** Rows of the history table that hold a workout (the header row has the "select all" box instead). */
function historyRows(page: Page) {
  return page.getByRole("row").filter({ has: page.getByRole("checkbox", { name: "Select workout", exact: true }) });
}

test.describe("Workouts", () => {
  test.describe("create", () => {
    test("should start a new workout from the current workout page", async ({ page }) => {
      await openPage(page, "/current-workout");

      await page.getByRole("button", { name: "Start Workout" }).click();

      await expect(page.getByRole("button", { name: "Complete Workout" })).toBeVisible();
      await expect(page.getByLabel("Movement", { exact: true })).toBeVisible();
      await expect(page.getByText("No active workout")).toBeHidden();
    });

    test("should show the workout date after starting", async ({ page }) => {
      // The browser's clock is moved forward after starting, so today's date and the start date
      // differ, and only a card that shows when the workout started passes (ADR 0007).
      await page.clock.install();
      await startWorkout(page);
      // Read from the card rather than computed here, so a midnight between the two can't fail it.
      const cardDate = page.getByRole("heading", { level: 3 });
      const startDay = await cardDate.textContent();
      const timeZone = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
      const twoDaysLater = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
      expect(startDay).not.toBe(longDate(twoDaysLater, timeZone));
      await page.clock.setSystemTime(twoDaysLater);

      // Away and back through the menu, so the page renders again with the moved clock.
      await page.getByRole("link", { name: "Workout History" }).click();
      await expect(page.getByRole("heading", { name: "Workout History" })).toBeVisible();
      await page.getByRole("link", { name: "Current Workout" }).click();

      await expect(page.getByRole("heading", { name: "Current Workout" })).toBeVisible();
      await expect(cardDate).toHaveText(startDay!);
    });

  });

  test.describe("read", () => {
    test("should display the current active workout", async ({ page }) => {
      const movement = `Back Squat ${uniqueToken()}`;
      await createMovement(page, movement);
      await startWorkout(page);
      await addSet(page, { movement, weight: 225, reps: 5 });

      await openPage(page, "/current-workout");

      await expect(page.getByRole("button", { name: "Complete Workout" })).toBeVisible();
      await expect(page.getByRole("listitem").filter({ hasText: movement })).toContainText("5 reps × 225 lb");
    });

    test("should show 'No active workout' when none exists", async ({ page }) => {
      await openPage(page, "/current-workout");

      await expect(page.getByText("No active workout")).toBeVisible();
      await expect(page.getByRole("button", { name: "Start Workout" })).toBeVisible();
    });

    test("should display completed workouts in workout history", async ({ page }) => {
      const movement = `Deadlift ${uniqueToken()}`;
      await createMovement(page, movement);
      await logCompletedWorkout(page, { movement, weight: 315, reps: 3 });

      await openPage(page, "/workout-history");

      await expect(page.getByRole("columnheader", { name: movement })).toBeVisible();
      await expect(historyRows(page)).toHaveText([/315 lb \/ 3 reps \/ 1 sets/]);
    });

    test("should show a decimal weight in workout history", async ({ page }) => {
      const movement = `Romanian Deadlift ${uniqueToken()}`;
      await createMovement(page, movement);
      await logCompletedWorkout(page, { movement, weight: 135.5, reps: 5 });

      await openPage(page, "/workout-history");

      await expect(historyRows(page)).toHaveText([/135.5 lb \/ 5 reps \/ 1 sets/]);
    });
  });

  test.describe("complete", () => {
    test("should mark the current workout as completed", async ({ page }) => {
      const movement = `Overhead Press ${uniqueToken()}`;
      await createMovement(page, movement);
      await startWorkout(page);
      await addSet(page, { movement, weight: 95, reps: 8 });

      await page.getByRole("button", { name: "Complete Workout" }).click();

      await expect(page.getByText("No active workout")).toBeVisible();
      // Completing was saved, not just hidden.
      await openPage(page, "/current-workout");
      await expect(page.getByText("No active workout")).toBeVisible();
    });

    test("should move completed workout to history", async ({ page }) => {
      const movement = `Dips ${uniqueToken()}`;
      await createMovement(page, movement);
      await openPage(page, "/workout-history");
      await expect(page.getByText("No completed workouts yet.")).toBeVisible();
      await startWorkout(page);
      await addSet(page, { movement, weight: 0, reps: 12 });

      await completeWorkout(page);

      await openPage(page, "/workout-history");
      await expect(historyRows(page)).toHaveText([/0 lb \/ 12 reps \/ 1 sets/]);
    });
  });

  test.describe("delete", () => {
    test("should delete selected workouts from history", async ({ page }) => {
      const movement = `Bench Press ${uniqueToken()}`;
      await createMovement(page, movement);
      // Same day, so the weight tells the two rows apart.
      await logCompletedWorkout(page, { movement, weight: 111, reps: 5 });
      await logCompletedWorkout(page, { movement, weight: 222, reps: 5 });
      await openPage(page, "/workout-history");

      await historyRows(page).filter({ hasText: "111 lb" }).getByRole("checkbox").check();
      await page.getByRole("button", { name: "Delete Selected (1)" }).click();

      await expect(historyRows(page)).toHaveText([/222 lb/]);
      // The deletion was saved, not just hidden.
      await openPage(page, "/workout-history");
      await expect(historyRows(page)).toHaveText([/222 lb/]);
    });

    test("should allow selecting multiple workouts for deletion", async ({ page }) => {
      const movement = `Pull-up ${uniqueToken()}`;
      await createMovement(page, movement);
      await logCompletedWorkout(page, { movement, weight: 0, reps: 8 });
      await logCompletedWorkout(page, { movement, weight: 25, reps: 6 });
      await openPage(page, "/workout-history");

      await historyRows(page).filter({ hasText: "0 lb" }).getByRole("checkbox").check();
      await historyRows(page).filter({ hasText: "25 lb" }).getByRole("checkbox").check();
      await page.getByRole("button", { name: "Delete Selected (2)" }).click();

      await expect(page.getByText("No completed workouts yet.")).toBeVisible();
      await openPage(page, "/workout-history");
      await expect(page.getByText("No completed workouts yet.")).toBeVisible();
    });
  });
});
