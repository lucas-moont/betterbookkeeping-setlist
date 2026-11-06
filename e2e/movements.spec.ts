import { test, expect } from "./fixtures";
import { createMovement, openPage, signOut, signUpAsNewUser, startWorkout, uniqueToken } from "./helpers";

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

    // Names are unique per user, ignoring case and the spaces around them (ADR 0001).
    test("should show an error in the form for a name the user already has", async ({ page }) => {
      const name = `Bench Press ${uniqueToken()}`;
      await createMovement(page, name);
      const nameField = page.getByLabel("Movement name");

      await nameField.fill(`  ${name.toUpperCase()} `);
      await page.getByRole("button", { name: "Add" }).click();

      // In the form: the message describes the field, unlike a toast.
      await expect(nameField).toHaveAccessibleDescription("You already have a movement with this name");
      await expect(nameField).toHaveAttribute("aria-invalid", "true");
      await expect(nameField).toHaveValue(`  ${name.toUpperCase()} `);
      await expect(page.getByRole("listitem")).toHaveText([name]);
    });
  });

  test.describe("read", () => {
    test("should display all movements on the movements page", async ({ page }) => {
      const names = [`Dumbbell Curl ${uniqueToken()}`, `Overhead Press ${uniqueToken()}`];
      for (const name of names) await createMovement(page, name);

      await openPage(page, "/movements");

      // Each test signs in as a new user, who only sees their own movements (ADR 0001).
      await expect(page.getByRole("listitem")).toHaveText(names);
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
