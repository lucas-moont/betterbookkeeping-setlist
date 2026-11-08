import { test, expect, type Page } from "./fixtures";
import { createMovement, openPage, uniqueToken } from "./helpers";

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

test("the desktop keeps the sidebar and has no bottom bar", async ({ page }) => {
  await openPage(page, "/current-workout");

  const nav = mainNav(page);
  await expect(nav.getByRole("link", { name: "Current Workout" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Workout", exact: true })).toBeHidden();
  await expect(nav.getByRole("button", { name: "Log out" })).toBeVisible();
});
