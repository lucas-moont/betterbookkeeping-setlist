import { test, expect, type Page } from "./fixtures";
import {
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
    await expect(
      page.getByText("No body weight recorded yet. Enter it as the weight: it's saved as today's body weight too."),
    ).toBeVisible();

    await page.getByLabel("Body weight", { exact: true }).fill("171.25");
    await page.getByLabel("Reps").fill("8");
    await page.getByLabel("Number of sets").fill("1");
    await addSetButton(page).click();

    await expect(page.getByRole("status")).toHaveText("Set added. 171.25 lb is also saved as today's body weight.");
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
      await expect(page.getByRole("alert")).toBeHidden();
    });

    test("should ask for the amount and the description of an added weight", async ({ page }) => {
      await openPage(page, "/profile");
      await recordBodyWeight(page, 172.4);
      const movement = await pickBodyWeightMovement(page);
      await addedWeightButton(page).click();
      await page.getByLabel("Reps").fill("6");
      const amount = page.getByLabel("Added weight in pounds");
      const note = page.getByLabel("Description of the added weight");

      await addSetButton(page).click();

      await expect(page.getByRole("alert")).toHaveText("Enter the added weight, or remove it.");
      await expect(amount).toHaveAttribute("aria-invalid", "true");

      await amount.fill("25");
      await addSetButton(page).click();

      await expect(page.getByRole("alert")).toHaveText('Describe the added weight, for example "weighted vest".');
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

      await expect(page.getByRole("alert")).toHaveText("Assistance can't be more than your body weight (172.4 lb).");
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

  test("should ask for a body weight above 0 when there is none yet", async ({ page }) => {
    const movement = await pickBodyWeightMovement(page);

    await page.getByLabel("Body weight", { exact: true }).fill("0");
    await page.getByLabel("Reps").fill("8");
    await addSetButton(page).click();

    await expect(page.getByRole("alert").filter({ hasText: "Enter your body weight above 0" })).toBeVisible();
    await expect(page.getByLabel("Body weight", { exact: true })).toHaveAttribute("aria-invalid", "true");
    await expect(setRows(page, movement)).toHaveCount(0);
  });
});
