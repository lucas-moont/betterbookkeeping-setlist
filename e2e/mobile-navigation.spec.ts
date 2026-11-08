import { test, expect, type Page } from "./fixtures";
import { createMovement, logCompletedWorkout, openPage, uniqueToken } from "./helpers";

// Below 768 px a bottom bar replaces the sidebar (DESIGN.md, Layout). The fixture signs up at the
// desktop size; each test then turns the window into a phone's (iPhone SE).
const phone = { width: 375, height: 667 };

/** The navigation on screen: the bottom bar on a phone, the sidebar on a desktop. */
function mainNav(page: Page) {
  return page.getByRole("navigation", { name: "Main" });
}

test.describe("Bottom navigation on phones", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(phone);
  });

  test("shows the five destinations and marks the page you're on", async ({ page }) => {
    await openPage(page, "/current-workout");
    const nav = mainNav(page);

    await expect(nav.getByRole("link")).toHaveText(["Workout", "History", "Movements", "Profile"]);
    await expect(nav.getByRole("button", { name: "Log out" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Workout" })).toHaveAttribute("aria-current", "page");
    // The sidebar is gone at this width, its links with it.
    await expect(page.getByRole("link", { name: "Current Workout" })).toBeHidden();

    await nav.getByRole("link", { name: "History" }).click();

    await expect(page).toHaveURL(/\/workout-history$/);
    await expect(nav.getByRole("link", { name: "History" })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: "Workout" })).not.toHaveAttribute("aria-current", "page");
  });

  test("Log out signs out at once", async ({ page }) => {
    await openPage(page, "/current-workout");

    await mainNav(page).getByRole("button", { name: "Log out" }).click();

    await expect(page).toHaveURL(/\/sign-in$/);
    // Signed out on the server, not only sent to the sign-in page.
    await openPage(page, "/current-workout");
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test("the end of a long page scrolls clear of the bar", async ({ page }) => {
    const token = uniqueToken();
    for (const name of ["Bench Press", "Back Squat", "Deadlift", "Overhead Press", "Pull-up", "Row"]) {
      await createMovement(page, `${name} ${token}`);
    }
    await openPage(page, "/movements");

    await page.locator("main").evaluate((main) => main.scrollTo(0, main.scrollHeight));

    const last = page.getByRole("listitem").filter({ hasText: `Row ${token}` });
    const lastBox = await last.boundingBox();
    const navBox = await mainNav(page).boundingBox();
    expect(lastBox!.y + lastBox!.height).toBeLessThanOrEqual(navBox!.y);
  });
});

test("no page scrolls sideways on a phone", async ({ page }) => {
  await page.setViewportSize(phone);
  const movement = `Romanian Deadlift With Pause ${uniqueToken()}`;
  await createMovement(page, movement);
  await logCompletedWorkout(page, { movement, weight: 225, reps: 8 });

  for (const path of ["/current-workout", "/workout-history", "/movements", "/profile"]) {
    await openPage(page, path);
    // Wide content (the history table) scrolls inside its own region, never the page.
    const widths = await page.evaluate(() => {
      const main = document.querySelector("main")!;
      return [document.documentElement.scrollWidth, main.scrollWidth, main.clientWidth];
    });
    expect(widths, path).toEqual([phone.width, widths[2], widths[2]]);
  }
});

test.describe("Profile and fields on phones", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(phone);
  });

  test("the Profile says who is signed in", async ({ page }) => {
    await openPage(page, "/profile");

    // In the page, not the sidebar's user block, which is hidden at this width. The fixture signs up as "E2E User".
    const main = page.locator("main");
    await expect(main.getByText("Logged in as")).toBeVisible();
    await expect(main.getByText("E2E User", { exact: true })).toBeVisible();
  });

  // 44 px to tap, and 16 px text so iOS doesn't zoom in when a field gets the focus.
  test("the body weight form and Complete are phone-sized", async ({ page }) => {
    await openPage(page, "/profile");
    for (const control of [
      page.getByLabel("Date"),
      page.getByLabel("Weight in pounds"),
      page.getByRole("button", { name: "Record" }),
    ]) {
      expect(
        await control.evaluate((el) => [el.getBoundingClientRect().height, getComputedStyle(el).fontSize]),
      ).toEqual([44, "16px"]);
    }

    await openPage(page, "/current-workout");
    await page.getByRole("button", { name: "Start Workout" }).click();
    const complete = page.getByRole("button", { name: "Complete", exact: true });
    await expect(complete).toBeVisible();
    expect((await complete.boundingBox())!.height).toBe(44);
  });
});

test("the desktop keeps the sidebar and has no bottom bar", { tag: "@desktop" }, async ({ page }) => {
  await openPage(page, "/current-workout");

  const nav = mainNav(page);
  await expect(nav.getByRole("link", { name: "Current Workout" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Workout", exact: true })).toBeHidden();
  await expect(nav.getByRole("button", { name: "Log out" })).toBeVisible();
});

test("the desktop Profile leaves who is signed in to the sidebar", { tag: "@desktop" }, async ({ page }) => {
  await openPage(page, "/profile");

  await expect(page.locator("main").getByText("Logged in as")).toBeHidden();
  await expect(page.getByRole("navigation", { name: "Main" }).getByText("Logged in as")).toBeVisible();
});
