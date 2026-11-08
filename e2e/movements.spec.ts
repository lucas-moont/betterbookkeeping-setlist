import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";
import { createMovement, openPage, signOut, signUpAsNewUser, startWorkout, uniqueToken } from "./helpers";

// The names in the list, in order. A row's own text also holds its muscle group select's options
// and the body-weight indicator, so the checks read the name alone.
const movementNames = (page: Page) => page.getByTestId("movement-name");
const movementRow = (page: Page, name: string) =>
  page.getByRole("listitem").filter({ has: page.getByTestId("movement-name").getByText(name, { exact: true }) });

test.describe("Movements", () => {
  test.describe("create", () => {
    test("should create a new movement with a valid name", async ({ page }) => {
      const name = `Bench Press ${uniqueToken()}`;
      await openPage(page, "/movements");

      await page.getByLabel("Movement name").fill(name);
      await page.getByRole("button", { name: "Add", exact: true }).click();

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

    // Names are unique per user, ignoring case and the spaces around them (ADR 0001).
    test("should show an error in the form for a name the user already has", async ({ page }) => {
      const name = `Bench Press ${uniqueToken()}`;
      await createMovement(page, name);
      const nameField = page.getByLabel("Movement name");

      await nameField.fill(`  ${name.toUpperCase()} `);
      await page.getByRole("button", { name: "Add", exact: true }).click();

      // In the form: the message describes the field, unlike a toast.
      await expect(nameField).toHaveAccessibleDescription("You already have a movement with this name");
      await expect(nameField).toHaveAttribute("aria-invalid", "true");
      await expect(nameField).toHaveValue(`  ${name.toUpperCase()} `);
      await expect(movementNames(page)).toHaveText([name]);
    });
  });

  test.describe("read", () => {
    test("should display all movements on the movements page", async ({ page }) => {
      const names = [`Dumbbell Curl ${uniqueToken()}`, `Overhead Press ${uniqueToken()}`];
      for (const name of names) await createMovement(page, name);

      await openPage(page, "/movements");

      // Each test signs in as a new user, who only sees their own movements (ADR 0001).
      await expect(movementNames(page)).toHaveText(names);
    });

    test("should show movements sorted alphabetically", async ({ page }) => {
      const token = uniqueToken();
      for (const suffix of ["Charlie", "Alpha", "Bravo"]) await createMovement(page, `${token} ${suffix}`);

      await openPage(page, "/movements");

      await expect(movementNames(page).filter({ hasText: token })).toHaveText([
        `${token} Alpha`,
        `${token} Bravo`,
        `${token} Charlie`,
      ]);
    });
  });

  test.describe("body-weight flag", () => {
    test("should show the body-weight indicator on a movement created as body-weight", async ({ page }) => {
      const pullUp = `Pull-up ${uniqueToken()}`;
      const row = `Barbell Row ${uniqueToken()}`;
      await createMovement(page, pullUp, { bodyWeight: true });
      await createMovement(page, row);

      // A fresh load reads the flag from the server.
      await openPage(page, "/movements");

      await expect(movementRow(page, pullUp).getByText("Body-weight", { exact: true })).toBeVisible();
      await expect(movementRow(page, row).getByText("Body-weight", { exact: true })).toHaveCount(0);
      await expect(page.getByLabel("Body-weight")).not.toBeChecked();
    });
  });

  test.describe("edit", () => {
    test("should change the name, the body-weight flag and the muscle group in one dialog", async ({ page }) => {
      const name = `Pullup ${uniqueToken()}`;
      const renamed = name.replace("Pullup", "Pull-up");
      await createMovement(page, name);

      await page.getByRole("button", { name: `Edit ${name}` }).click();
      const dialog = page.getByRole("dialog", { name: "Edit movement" });
      await dialog.getByLabel("Name").fill(renamed);
      await dialog.getByLabel("Muscle group").selectOption({ label: "Back" });
      await dialog.getByLabel("Body-weight").check();
      await dialog.getByRole("button", { name: "Save" }).click();

      await expect(dialog).toBeHidden();
      await openPage(page, "/movements");
      await expect(movementNames(page)).toHaveText([renamed]);
      await expect(movementRow(page, renamed).getByText("Body-weight", { exact: true })).toBeVisible();
      await expect(page.getByLabel(`Muscle group for ${renamed}`)).toHaveValue("BACK");
    });

    test("should start the dialog from the movement as it is, and change nothing on Cancel", async ({ page }) => {
      const name = `Dips ${uniqueToken()}`;
      await createMovement(page, name, { muscleGroup: "Chest", bodyWeight: true });

      await page.getByRole("button", { name: `Edit ${name}` }).click();
      const dialog = page.getByRole("dialog", { name: "Edit movement" });
      await expect(dialog.getByLabel("Name")).toHaveValue(name);
      await expect(dialog.getByLabel("Muscle group")).toHaveValue("CHEST");
      await expect(dialog.getByLabel("Body-weight")).toBeChecked();
      await dialog.getByLabel("Name").fill("Something else");
      await dialog.getByRole("button", { name: "Cancel" }).click();

      await expect(dialog).toBeHidden();
      await expect(movementNames(page)).toHaveText([name]);
      // The native <dialog> gives the focus back to the button that opened it.
      await expect(page.getByRole("button", { name: `Edit ${name}` })).toBeFocused();
    });

    // Names are unique per user, ignoring case and the spaces around them (ADR 0001).
    test("should show an error in the dialog for a name the user already has", async ({ page }) => {
      const bench = `Bench Press ${uniqueToken()}`;
      const squat = `Squat ${uniqueToken()}`;
      await createMovement(page, bench);
      await createMovement(page, squat);

      await page.getByRole("button", { name: `Edit ${squat}` }).click();
      const dialog = page.getByRole("dialog", { name: "Edit movement" });
      const nameField = dialog.getByLabel("Name");
      await nameField.fill(` ${bench.toUpperCase()} `);
      await dialog.getByRole("button", { name: "Save" }).click();

      await expect(nameField).toHaveAccessibleDescription("You already have a movement with this name");
      await expect(nameField).toHaveAttribute("aria-invalid", "true");
      await expect(dialog).toBeVisible();
      await expect(movementNames(page)).toHaveText([bench, squat]);
    });
  });

  test.describe("muscle groups", () => {
    test("should change a movement's muscle group from its row", async ({ page }) => {
      const name = `Back Squat ${uniqueToken()}`;
      await createMovement(page, name, { muscleGroup: "Chest" });
      const select = page.getByLabel(`Muscle group for ${name}`);
      await expect(select).toHaveValue("CHEST");

      await select.selectOption({ label: "Legs" });
      await expect(select).toHaveValue("LEGS");

      // A fresh load proves the server saved it.
      await page.waitForLoadState("networkidle");
      await openPage(page, "/movements");
      await expect(page.getByLabel(`Muscle group for ${name}`)).toHaveValue("LEGS");
    });

    test("should filter the movements by muscle group", async ({ page }) => {
      const squat = `Back Squat ${uniqueToken()}`;
      const lunge = `Lunge ${uniqueToken()}`;
      const bench = `Bench Press ${uniqueToken()}`;
      const curl = `Curl ${uniqueToken()}`;
      await createMovement(page, squat, { muscleGroup: "Legs" });
      await createMovement(page, lunge, { muscleGroup: "Legs" });
      await createMovement(page, bench, { muscleGroup: "Chest" });
      await createMovement(page, curl);
      const filters = page.getByRole("group", { name: "Filter by muscle group" }).getByRole("button");

      // All, then each group in use in the fixed order, then No group, each with its count.
      await expect(filters).toHaveText(["All4", "Chest1", "Legs2", "No group1"]);

      await filters.filter({ hasText: "Legs" }).click();
      await expect(filters.filter({ hasText: "Legs" })).toHaveAttribute("aria-pressed", "true");
      await expect(movementNames(page)).toHaveText([squat, lunge]);

      await filters.filter({ hasText: "No group" }).click();
      await expect(movementNames(page)).toHaveText([curl]);

      await filters.filter({ hasText: "All" }).click();
      await expect(movementNames(page)).toHaveText([squat, bench, curl, lunge]);
    });
  });

  test.describe("ownership", () => {
    test("should never show another user's movements", async ({ page }) => {
      await createMovement(page, `Front Squat ${uniqueToken()}`);
      await signOut(page);

      await signUpAsNewUser(page);

      await openPage(page, "/movements");
      await expect(page.getByText("No movements yet")).toBeVisible();
      await startWorkout(page);
      await expect(page.getByLabel("Movement", { exact: true }).getByRole("option")).toHaveText(["Select movement"]);
    });

    // Before movements had an owner, a signed-out visitor could add to everyone's library. The
    // request is replayed exactly as the browser sent it, minus the session cookie.
    test("should refuse to create a movement for a signed-out visitor", async ({ page }) => {
      const name = `Lunge ${uniqueToken()}`;
      const createRequest = page.waitForRequest(
        (request) => request.method() === "POST" && (request.postData() ?? "").includes(name),
      );
      await createMovement(page, name);
      const request = await createRequest;
      await signOut(page);

      const { cookie: _sessionCookie, ...headers } = await request.allHeaders();
      const replay = await page.request.post(request.url(), {
        headers,
        data: request.postData()!.replace(name, `${name} by a visitor`),
        maxRedirects: 0,
      });

      // The auth middleware answers with a redirect to sign-in before the handler runs.
      expect(replay.headers()["location"]).toBe("/sign-in");
      expect(await replay.json()).toMatchObject({ to: "/sign-in", isSerializedRedirect: true });
    });
  });
});
