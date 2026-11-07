import { test, expect, type Page } from "./fixtures";
import {
  addSet,
  addSetButton,
  createMovement,
  openPage,
  recordBodyWeight,
  setRows,
  startWorkout,
  uniqueToken,
} from "./helpers";

/** Creates a Body-weight Movement and starts a workout with it picked in the set form. */
async function pickBodyWeightMovement(page: Page) {
  const movement = `Pull-up ${uniqueToken()}`;
  await createMovement(page, movement, { bodyWeight: true });
  await startWorkout(page);
  await page.getByLabel("Movement", { exact: true }).selectOption({ label: movement });
  return movement;
}

/** The set form, which holds its own errors and notice; a toast is role="alert" too. */
function setForm(page: Page) {
  return page.getByRole("form", { name: "Add a set" });
}

function addedWeightButton(page: Page) {
  return page.getByRole("button", { name: "Added weight", exact: true });
}

function signButton(page: Page, sign: "Extra" | "Assistance") {
  return page.getByRole("group", { name: "Added weight type" }).getByRole("button", { name: sign });
}

test.describe("Body-weight sets", () => {
  test("should lock the weight to the latest body weight", async ({ page }) => {
    await openPage(page, "/profile");
    await recordBodyWeight(page, 172.4);
    const movement = await pickBodyWeightMovement(page);

    const weightField = page.getByLabel("Body weight, from your latest entry");
    await expect(weightField).toHaveValue("172.4");
    await expect(weightField).toHaveAttribute("readonly");
    await expect(page.getByText(`${movement} uses your latest body weight: 172.4 lb from `)).toBeVisible();

    await page.getByLabel("Reps").fill("8");
    await page.getByLabel("Number of sets").fill("1");
    await addSetButton(page).click();

    await expect(setRows(page, movement)).toHaveText(["Set 1 8 reps × 172.4 lb"]);
  });

  test("should save the first body weight from the set as today's body weight", async ({ page }) => {
    const movement = await pickBodyWeightMovement(page);
    // A note, not an alert: it stays on screen while the movement is picked.
    await expect(setForm(page).getByRole("note")).toHaveText(
      "No body weight recorded yet. Enter it as the weight: it's saved as today's body weight too.",
    );
    await expect(setForm(page).getByRole("alert")).toHaveCount(0);

    // Mounted before there is anything to say, so a screen reader announces the text when it comes.
    await expect(setForm(page).getByRole("status")).toHaveText("");
    await page.getByLabel("Body weight", { exact: true }).fill("171.25");
    await page.getByLabel("Reps").fill("8");
    await page.getByLabel("Number of sets").fill("1");
    await addSetButton(page).click();

    await expect(setForm(page).getByRole("status")).toHaveText("Set added. 171.25 lb is also saved as today's body weight.");
    await expect(setRows(page, movement)).toHaveText(["Set 1 8 reps × 171.25 lb"]);
    // The next set takes it from the entry just saved.
    await expect(page.getByLabel("Body weight, from your latest entry")).toHaveValue("171.25");
    await openPage(page, "/profile");
    await expect(page.getByText(/^Latest: 171\.25 lb on /)).toBeVisible();
  });

  test.describe("added weight", () => {
    test("should offer an added weight only for body-weight movements", async ({ page }) => {
      const movement = `Bench Press ${uniqueToken()}`;
      await createMovement(page, movement);
      await pickBodyWeightMovement(page);
      await expect(addedWeightButton(page)).toBeVisible();

      await page.getByLabel("Movement", { exact: true }).selectOption({ label: movement });

      await expect(addedWeightButton(page)).toBeHidden();
    });

    test("should add a set with extra weight", async ({ page }) => {
      await openPage(page, "/profile");
      await recordBodyWeight(page, 172.4);
      const movement = await pickBodyWeightMovement(page);

      await addedWeightButton(page).click();
      await expect(signButton(page, "Extra")).toHaveAttribute("aria-pressed", "true");
      await page.getByLabel("Added weight in pounds").fill("25");
      await page.getByLabel("Description of the added weight").fill("weighted vest");
      await page.getByLabel("Reps").fill("6");
      await page.getByLabel("Number of sets").fill("1");
      await addSetButton(page).click();

      await expect(setRows(page, movement)).toHaveCount(1);
      await expect(setForm(page).getByRole("alert")).toBeHidden();
    });

    test("should ask for the amount and the description of an added weight", async ({ page }) => {
      await openPage(page, "/profile");
      await recordBodyWeight(page, 172.4);
      const movement = await pickBodyWeightMovement(page);
      await addedWeightButton(page).click();
      await page.getByLabel("Reps").fill("6");
      const amount = page.getByLabel("Added weight in pounds");
      const note = page.getByLabel("Description of the added weight");

      const messages = setForm(page).getByRole("alert").getByRole("paragraph");

      await addSetButton(page).click();

      await expect(messages).toHaveText([
        "Enter the added weight, or remove it.",
        'Describe the added weight, for example "weighted vest".',
      ]);
      await expect(amount).toHaveAttribute("aria-invalid", "true");
      await expect(note).toHaveAttribute("aria-invalid", "true");

      // The same rule as the server's: an added weight of 0 is no added weight.
      await note.fill("weighted vest");
      await amount.fill("0");
      await addSetButton(page).click();

      await expect(setForm(page).getByRole("alert")).toHaveText("Enter an added weight other than 0");
      await expect(amount).toHaveAttribute("aria-invalid", "true");
      await expect(note).not.toHaveAttribute("aria-invalid", "true");

      await note.fill("");
      await amount.fill("25");
      await addSetButton(page).click();

      await expect(setForm(page).getByRole("alert")).toHaveText('Describe the added weight, for example "weighted vest".');
      await expect(note).toHaveAttribute("aria-invalid", "true");
      await expect(amount).not.toHaveAttribute("aria-invalid", "true");
      await expect(setRows(page, movement)).toHaveCount(0);
    });

    test("should refuse more assistance than the body weight", async ({ page }) => {
      await openPage(page, "/profile");
      await recordBodyWeight(page, 172.4);
      const movement = await pickBodyWeightMovement(page);
      await addedWeightButton(page).click();

      await signButton(page, "Assistance").click();
      await expect(page.getByLabel("Description of the added weight")).toHaveAttribute(
        "placeholder",
        "e.g. resistance band",
      );
      await page.getByLabel("Added weight in pounds").fill("200");
      await page.getByLabel("Description of the added weight").fill("assisted machine");
      await page.getByLabel("Reps").fill("6");
      await addSetButton(page).click();

      await expect(setForm(page).getByRole("alert")).toHaveText("Assistance can't be more than your body weight (172.4 lb).");
      await expect(setRows(page, movement)).toHaveCount(0);
    });

    test("should remove the added weight", async ({ page }) => {
      await pickBodyWeightMovement(page);
      await addedWeightButton(page).click();
      await page.getByLabel("Added weight in pounds").fill("25");

      await page.getByRole("button", { name: "Remove added weight" }).click();

      await expect(page.getByLabel("Added weight in pounds")).toBeHidden();
      await expect(addedWeightButton(page)).toBeFocused();
    });
  });

  test.describe("set rows", () => {
    test("should show the body weight plus the extra weight and its description", async ({ page }) => {
      await openPage(page, "/profile");
      await recordBodyWeight(page, 172.4);
      const movement = await pickBodyWeightMovement(page);

      await addSet(page, { movement, reps: 6, added: { sign: "extra", amount: 25, note: "weighted vest" } });

      await expect(setRows(page, movement)).toHaveText(["Set 1 6 reps × 172.4 lb + 25 lb (weighted vest)"]);
      await expect(setRows(page, movement).getByRole("checkbox")).toHaveAccessibleName(
        `Completed: ${movement}, set 1, 197.4 lb × 6`,
      );
    });

    test("should show the body weight minus the assistance and its description", async ({ page }) => {
      await openPage(page, "/profile");
      await recordBodyWeight(page, 172.4);
      const movement = await pickBodyWeightMovement(page);

      await addSet(page, {
        movement,
        reps: 6,
        added: { sign: "assistance", amount: 40, note: "resistance band" },
      });

      await expect(setRows(page, movement)).toHaveText(["Set 1 6 reps × 172.4 lb − 40 lb (resistance band)"]);
      await expect(setRows(page, movement).getByRole("checkbox")).toHaveAccessibleName(
        `Completed: ${movement}, set 1, 132.4 lb × 6`,
      );
    });

    test("should show a planned set at the latest body weight, and a completed one at its own", async ({ page }) => {
      await openPage(page, "/profile");
      await recordBodyWeight(page, 172.4);
      const movement = await pickBodyWeightMovement(page);
      await addSet(page, { movement, reps: 6, count: 2, added: { sign: "assistance", amount: 160, note: "machine" } });
      await page.getByRole("checkbox", { name: `Completed: ${movement}, set 2, 12.4 lb × 6` }).click();
      await expect(page.getByRole("region", { name: movement, exact: true })).toContainText("1 of 2 completed");

      await openPage(page, "/profile");
      await recordBodyWeight(page, 150);
      await openPage(page, "/current-workout");

      await expect(setRows(page, movement)).toHaveText([
        "Set 1 6 reps × 172.4 lb − 160 lb (machine)",
        "Set 2 6 reps × 150 lb − 160 lb (machine)",
      ]);
      // The assistance is now more than the body weight: no negative Load, the parts instead.
      const planned = setRows(page, movement).nth(1).getByRole("checkbox");
      await expect(planned).toHaveAccessibleName(`Completed: ${movement}, set 2, 150 lb − 160 lb × 6`);

      await planned.click();

      await expect(page.getByText("Assistance can't be more than your body weight")).toBeVisible();
      await expect(planned).toHaveAttribute("aria-checked", "false");
    });
  });

  test("should ask for a body weight above 0 when there is none yet", async ({ page }) => {
    const movement = await pickBodyWeightMovement(page);

    await page.getByLabel("Body weight", { exact: true }).fill("0");
    await page.getByLabel("Reps").fill("8");
    await addSetButton(page).click();

    await expect(setForm(page).getByRole("alert").filter({ hasText: "Enter your body weight above 0" })).toBeVisible();
    await expect(page.getByLabel("Body weight", { exact: true })).toHaveAttribute("aria-invalid", "true");
    await expect(setRows(page, movement)).toHaveCount(0);
  });
});
