import { test, expect } from "./fixtures";
import { createMovement, openPage, uniqueToken } from "./helpers";

test.describe("Movements", () => {
  test.describe("create", () => {
    test("should create a new movement with a valid name", async ({ page }) => {
      const name = `Bench Press ${uniqueToken()}`;
      await openPage(page, "/movements");

      await page.getByLabel("Movement name").fill(name);
      await page.getByRole("button", { name: "Add" }).click();

      await expect(page.getByRole("listitem").filter({ hasText: name })).toBeVisible();
    });

    test("should show the new movement in the movements list", async ({ page }) => {
      const name = `Back Squat ${uniqueToken()}`;
      await createMovement(page, name);

      // A fresh load reads the list from the server, not from the client cache.
      await openPage(page, "/movements");

      await expect(page.getByRole("listitem").filter({ hasText: name })).toBeVisible();
    });

    test("should clear the input after creating a movement", async ({ page }) => {
      await createMovement(page, `Deadlift ${uniqueToken()}`);

      await expect(page.getByLabel("Movement name")).toHaveValue("");
    });
  });

  test.describe("read", () => {
    test("should display all movements on the movements page", async ({ page }) => {
      const names = [`Dumbbell Curl ${uniqueToken()}`, `Overhead Press ${uniqueToken()}`];
      for (const name of names) await createMovement(page, name);

      await openPage(page, "/movements");

      // Until LUC-132 the movement library is shared by all users and parallel tests add to it,
      // so this checks that the list contains this test's movements, not that it equals them.
      for (const name of names) {
        await expect(page.getByRole("listitem").filter({ hasText: name })).toBeVisible();
      }
    });

    test("should show movements sorted alphabetically", async ({ page }) => {
      const token = uniqueToken();
      for (const suffix of ["Charlie", "Alpha", "Bravo"]) await createMovement(page, `${token} ${suffix}`);

      await openPage(page, "/movements");

      await expect(page.getByRole("listitem").filter({ hasText: token })).toHaveText([
        `${token} Alpha`,
        `${token} Bravo`,
        `${token} Charlie`,
      ]);
    });
  });
});
