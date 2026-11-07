import { test, expect } from "./fixtures";
import { addSet, addSetButton, createMovement, openPage, setRows, startWorkout, uniqueToken } from "./helpers";

test.describe("Sets", () => {
  test.describe("create", () => {
    test("should add a set to the current workout", async ({ page }) => {
      const movement = `Bench Press ${uniqueToken()}`;
      await createMovement(page, movement);
      await startWorkout(page);

      await page.getByLabel("Movement", { exact: true }).selectOption({ label: movement });
      await page.getByLabel("Weight").fill("100");
      await page.getByLabel("Reps").fill("5");
      await page.getByLabel("Number of sets").fill("1");
      await addSetButton(page).click();

      await expect(setRows(page, movement)).toHaveText(["Set 1 5 reps × 100 lb"]);
      await expect(page.getByText("No sets yet")).toBeHidden();
    });

    test("should add several identical sets at once", async ({ page }) => {
      const movement = `Bench Press ${uniqueToken()}`;
      await createMovement(page, movement);
      await startWorkout(page);
      const countField = page.getByLabel("Number of sets");
      await page.getByLabel("Movement", { exact: true }).selectOption({ label: movement });
      await page.getByLabel("Weight").fill("185");
      await page.getByLabel("Reps").fill("6");

      // Three sets unless the lifter asks for another number.
      await expect(countField).toHaveValue("3");
      await expect(addSetButton(page)).toHaveAccessibleName("Add 3 sets");
      await countField.fill("4");
      await expect(addSetButton(page)).toHaveAccessibleName("Add 4 sets");
      await addSetButton(page).click();

      await expect(setRows(page, movement)).toHaveText([
        "Set 1 6 reps × 185 lb",
        "Set 2 6 reps × 185 lb",
        "Set 3 6 reps × 185 lb",
        "Set 4 6 reps × 185 lb",
      ]);
      const section = page.getByRole("region", { name: movement, exact: true });
      await expect(section).toContainText("4 of 4 completed");
      const progress = section.getByRole("progressbar", { name: `${movement} sets completed` });
      await expect(progress).toHaveAttribute("aria-valuenow", "4");
      await expect(progress).toHaveAttribute("aria-valuemax", "4");
      // The next set is usually the same movement and weight with other reps.
      await expect(page.getByLabel("Reps")).toHaveValue("");
      await expect(countField).toHaveValue("4");

      await countField.fill("1");
      await expect(addSetButton(page)).toHaveAccessibleName("Add");
    });

    test("should refuse more sets than one add can take", async ({ page }) => {
      const movement = `Lunge ${uniqueToken()}`;
      await createMovement(page, movement);
      await startWorkout(page);
      const countField = page.getByLabel("Number of sets");
      await page.getByLabel("Movement", { exact: true }).selectOption({ label: movement });
      await page.getByLabel("Weight").fill("50");
      await page.getByLabel("Reps").fill("10");
      await countField.fill("11");

      await addSetButton(page).click();

      expect(await countField.evaluate((field: HTMLInputElement) => field.validity.rangeOverflow)).toBe(true);
      await expect(page.getByText("No sets yet")).toBeVisible();
    });

    test("should say that each set added counts as completed", async ({ page }) => {
      await startWorkout(page);

      await expect(addSetButton(page)).toHaveAccessibleDescription(
        "Each set you add counts as completed. Tap its circle to unmark a set you didn't do.",
      );
    });

    test("should require movement, weight, and reps to add a set", async ({ page }) => {
      const movement = `Pull-up ${uniqueToken()}`;
      await createMovement(page, movement);
      await startWorkout(page);
      const movementField = page.getByLabel("Movement", { exact: true });
      const weightField = page.getByLabel("Weight");
      const repsField = page.getByLabel("Reps");
      const addButton = addSetButton(page);
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

      await expect(setRows(page, movement)).toHaveText(["Set 1 5 reps × 135.5 lb"]);
    });

    test("should refuse a weight with more than two decimals", async ({ page }) => {
      const movement = `Front Squat ${uniqueToken()}`;
      await createMovement(page, movement);
      await startWorkout(page);
      const weightField = page.getByLabel("Weight");
      await page.getByLabel("Movement", { exact: true }).selectOption({ label: movement });
      await weightField.fill("1.005");
      await page.getByLabel("Reps").fill("5");

      await addSetButton(page).click();

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

      await expect(setRows(page, movement)).toHaveCount(1);
    });
  });

  test.describe("read", () => {
    test("should display sets with movement name, weight, and reps", async ({ page }) => {
      const movement = `Overhead Press ${uniqueToken()}`;
      await createMovement(page, movement);
      await startWorkout(page);

      await addSet(page, { movement, weight: 95, reps: 8 });

      await expect(page.getByRole("region", { name: movement, exact: true })).toBeVisible();
      await expect(setRows(page, movement)).toHaveText(["Set 1 8 reps × 95 lb"]);
    });

    test("should show sets in the order they were added", async ({ page }) => {
      const movement = `Romanian Deadlift ${uniqueToken()}`;
      await createMovement(page, movement);
      await startWorkout(page);
      // Neither ascending nor descending, so a sort by reps or weight can't pass by accident.
      for (const reps of [8, 3, 5]) await addSet(page, { movement, weight: 135, reps });

      await openPage(page, "/current-workout");

      await expect(setRows(page, movement)).toHaveText([/8 reps/, /3 reps/, /5 reps/]);
    });

    test("should group the sets by movement, in the order each movement first appears", async ({ page }) => {
      const token = uniqueToken();
      const squat = `Back Squat ${token}`;
      const bench = `Bench Press ${token}`;
      await createMovement(page, squat);
      await createMovement(page, bench);
      await startWorkout(page);
      await addSet(page, { movement: squat, weight: 225, reps: 5 });
      await addSet(page, { movement: bench, weight: 185, reps: 6 });
      await addSet(page, { movement: squat, weight: 245, reps: 3 });

      await openPage(page, "/current-workout");

      const sections = page.getByRole("region", { name: new RegExp(token) });
      await expect(sections).toHaveCount(2);
      await expect(sections.nth(0)).toHaveAccessibleName(squat);
      await expect(sections.nth(1)).toHaveAccessibleName(bench);
      await expect(setRows(page, squat)).toHaveText(["Set 1 5 reps × 225 lb", "Set 2 3 reps × 245 lb"]);
      await expect(setRows(page, bench)).toHaveText(["Set 1 6 reps × 185 lb"]);
    });

    test("should show the workout's muscle groups under its date", async ({ page }) => {
      const movement = `Bench Press ${uniqueToken()}`;
      await createMovement(page, movement, { muscleGroup: "Chest" });
      await startWorkout(page);
      const muscleGroups = page.getByRole("list", { name: "Muscle groups" });
      await expect(muscleGroups).toBeHidden();

      await addSet(page, { movement, weight: 185, reps: 6 });

      await expect(muscleGroups.getByRole("listitem")).toHaveText(["Chest"]);
    });
  });

  test.describe("delete", () => {
    test("should remove a set from the current workout", async ({ page }) => {
      const movement = `Dips ${uniqueToken()}`;
      await createMovement(page, movement);
      await startWorkout(page);
      await addSet(page, { movement, weight: 0, reps: 12 });

      await setRows(page, movement).getByRole("button", { name: "Remove set" }).click();

      await expect(setRows(page, movement)).toHaveCount(0);
      await expect(page.getByText("No sets yet")).toBeVisible();
    });

    test("should update the sets list after deletion", async ({ page }) => {
      const movement = `Bench Press ${uniqueToken()}`;
      await createMovement(page, movement);
      await startWorkout(page);
      await addSet(page, { movement, weight: 135, reps: 10 });
      await addSet(page, { movement, weight: 185, reps: 5 });
      const sets = setRows(page, movement);

      await sets.filter({ hasText: "135 lb" }).getByRole("button", { name: "Remove set" }).click();

      await expect(sets).toHaveText(["Set 1 5 reps × 185 lb"]);
      // The deletion was saved, not just hidden.
      await openPage(page, "/current-workout");
      await expect(sets).toHaveText(["Set 1 5 reps × 185 lb"]);
    });
  });
});
