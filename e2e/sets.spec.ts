import { test, expect } from "./fixtures";
import { addSet, createMovement, openPage, startWorkout, uniqueToken } from "./helpers";

test.describe("Sets", () => {
  test.describe("create", () => {
    test("should add a set to the current workout", async ({ page }) => {
      const movement = `Bench Press ${uniqueToken()}`;
      await createMovement(page, movement);
      await startWorkout(page);

      await page.getByLabel("Movement", { exact: true }).selectOption({ label: movement });
      await page.getByLabel("Weight").fill("100");
      await page.getByLabel("Reps").fill("5");
      await page.getByRole("button", { name: "Add" }).click();

      await expect(page.getByRole("listitem").filter({ hasText: movement })).toBeVisible();
      await expect(page.getByText("No sets yet")).toBeHidden();
    });

    test("should require movement, weight, and reps to add a set", async ({ page }) => {
      const movement = `Pull-up ${uniqueToken()}`;
      await createMovement(page, movement);
      await startWorkout(page);
      const movementField = page.getByLabel("Movement", { exact: true });
      const weightField = page.getByLabel("Weight");
      const repsField = page.getByLabel("Reps");
      const addButton = page.getByRole("button", { name: "Add" });
      await movementField.selectOption({ label: movement });
      await weightField.fill("0");
      await repsField.fill("8");
      await expect(addButton).toBeEnabled();

      // Leave out one field at a time, with the other two filled.
      await movementField.selectOption({ label: "Select movement" });
      await expect(addButton).toBeDisabled();
      await movementField.selectOption({ label: movement });
      await weightField.clear();
      await expect(addButton).toBeDisabled();
      await weightField.fill("0");
      await repsField.clear();
      await expect(addButton).toBeDisabled();
    });

    test("should add a set with a decimal weight", async ({ page }) => {
      const movement = `Incline Press ${uniqueToken()}`;
      await createMovement(page, movement);
      await startWorkout(page);
      await addSet(page, { movement, weight: 135.5, reps: 5 });

      // A fresh load reads the weight back from the database.
      await openPage(page, "/current-workout");

      await expect(page.getByRole("listitem").filter({ hasText: movement })).toHaveText(
        `${movement}5 reps × 135.5 lb`,
      );
    });

    test("should refuse a weight with more than two decimals", async ({ page }) => {
      const movement = `Front Squat ${uniqueToken()}`;
      await createMovement(page, movement);
      await startWorkout(page);
      const weightField = page.getByLabel("Weight");
      await page.getByLabel("Movement", { exact: true }).selectOption({ label: movement });
      await weightField.fill("1.005");
      await page.getByLabel("Reps").fill("5");

      await page.getByRole("button", { name: "Add" }).click();

      expect(await weightField.evaluate((field: HTMLInputElement) => field.validity.stepMismatch)).toBe(true);
      await expect(page.getByText("No sets yet")).toBeVisible();
    });

    test("should display the new set in the workout", async ({ page }) => {
      const movement = `Back Squat ${uniqueToken()}`;
      await createMovement(page, movement);
      await startWorkout(page);
      await addSet(page, { movement, weight: 225, reps: 5 });

      // A fresh load reads the workout from the server, not from the client cache.
      await openPage(page, "/current-workout");

      await expect(page.getByRole("listitem").filter({ hasText: movement })).toBeVisible();
    });
  });

  test.describe("read", () => {
    test("should display sets with movement name, weight, and reps", async ({ page }) => {
      const movement = `Overhead Press ${uniqueToken()}`;
      await createMovement(page, movement);
      await startWorkout(page);

      await addSet(page, { movement, weight: 95, reps: 8 });

      await expect(page.getByRole("listitem").filter({ hasText: movement })).toHaveText(`${movement}8 reps × 95 lb`);
    });

    // Skipped until LUC-134 adds Set.createdAt: sets have no defined order yet.
    test.skip("should show sets in the order they were added", async ({ page }) => {
      // TODO: Implement this test
    });
  });

  test.describe("delete", () => {
    test("should remove a set from the current workout", async ({ page }) => {
      const movement = `Dips ${uniqueToken()}`;
      await createMovement(page, movement);
      await startWorkout(page);
      await addSet(page, { movement, weight: 0, reps: 12 });

      await page
        .getByRole("listitem")
        .filter({ hasText: movement })
        .getByRole("button", { name: "Remove set" })
        .click();

      await expect(page.getByRole("listitem").filter({ hasText: movement })).toBeHidden();
      await expect(page.getByText("No sets yet")).toBeVisible();
    });

    test("should update the sets list after deletion", async ({ page }) => {
      const movement = `Bench Press ${uniqueToken()}`;
      await createMovement(page, movement);
      await startWorkout(page);
      await addSet(page, { movement, weight: 135, reps: 10 });
      await addSet(page, { movement, weight: 185, reps: 5 });
      const sets = page.getByRole("listitem").filter({ hasText: movement });

      await sets.filter({ hasText: "135 lb" }).getByRole("button", { name: "Remove set" }).click();

      await expect(sets).toHaveText([`${movement}5 reps × 185 lb`]);
      // The deletion was saved, not just hidden.
      await openPage(page, "/current-workout");
      await expect(sets).toHaveText([`${movement}5 reps × 185 lb`]);
    });
  });
});
