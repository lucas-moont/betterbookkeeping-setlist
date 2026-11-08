import { test, expect, type Locator, type Page } from "./fixtures";
import {
  addSet,
  createMovement,
  logCompletedWorkout,
  mainNav,
  openPage,
  setRows,
  startWorkout,
  uniqueToken,
} from "./helpers";

// Below 768 px a bottom bar replaces the sidebar (DESIGN.md, Layout). Tests tagged @phone run only
// on the "phone" project (375×667) and @desktop ones only on "chromium" (playwright.config.ts).

/** Fails, naming the page, if the page or its content is wider than the screen. */
async function expectNoSidewaysScroll(page: Page, where: string) {
  const widths = await page.evaluate(() => {
    const main = document.querySelector("main")!;
    return {
      screen: document.documentElement.clientWidth,
      page: document.documentElement.scrollWidth,
      content: main.scrollWidth,
      contentBox: main.clientWidth,
    };
  });
  expect(widths.page, `${where}: the page is as wide as the screen`).toBe(widths.screen);
  // Wide content (the history table) scrolls inside its own region, never the page.
  expect(widths.content, `${where}: the content fits its column`).toBe(widths.contentBox);
}

/** Fails, naming the control, unless it is 44 px tall with 16 px text: easy to tap, and no iOS zoom on focus. */
async function expectTouchSize(control: Locator, name: string) {
  const { height, fontSize } = await control.evaluate((el) => ({
    height: el.getBoundingClientRect().height,
    fontSize: getComputedStyle(el).fontSize,
  }));
  expect(height, `${name}: 44 px tall`).toBe(44);
  expect(fontSize, `${name}: 16 px text`).toBe("16px");
}

test.describe("Bottom navigation on phones", { tag: "@phone" }, () => {
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

// The issue's "done when", on a phone: logging, un-completing and changing a group, with nothing
// wider than the screen and fields that don't zoom.
test.describe("Phone flows", { tag: "@phone" }, () => {
  test("logging three sets and un-completing one, with touch-sized fields", async ({ page }) => {
    const movement = `Romanian Deadlift With Pause ${uniqueToken()}`;
    await createMovement(page, movement);
    await startWorkout(page);
    await expectNoSidewaysScroll(page, "the started workout");
    await expectTouchSize(page.getByLabel("Movement", { exact: true }), "Movement");
    await expectTouchSize(page.getByLabel("Weight", { exact: true }), "Weight");
    await expectTouchSize(page.getByLabel("Reps"), "Reps");
    await expectTouchSize(page.getByRole("button", { name: /^Add( \d+ sets)?$/ }), "Add");

    await addSet(page, { movement, weight: 225, reps: 8, count: 3 });
    await page.getByRole("checkbox", { name: `Completed: ${movement}, set 2, 225 lb × 8` }).click();

    await expect(setRows(page, movement).getByRole("checkbox", { checked: false })).toHaveCount(1);
    await expectNoSidewaysScroll(page, "three sets, one planned");
  });

  test("changing a movement's group from its row", async ({ page }) => {
    const movement = `Bench Press ${uniqueToken()}`;
    await createMovement(page, movement);
    await openPage(page, "/movements");
    const group = page.getByLabel(`Muscle group for ${movement}`);
    await expectTouchSize(group, "the row's group");

    await group.selectOption({ label: "Shoulders" });

    await expect(page.getByRole("group", { name: "Filter by muscle group" })).toContainText("Shoulders");
    await openPage(page, "/movements");
    await expect(page.getByLabel(`Muscle group for ${movement}`)).toHaveValue("SHOULDERS");
    await expectNoSidewaysScroll(page, "/movements after the change");
  });

  test("no page scrolls sideways", async ({ page }) => {
    const movement = `Romanian Deadlift With Pause ${uniqueToken()}`;
    await createMovement(page, movement);
    await logCompletedWorkout(page, { movement, weight: 225, reps: 8 });

    for (const path of ["/current-workout", "/workout-history", "/movements", "/profile"]) {
      await openPage(page, path);
      await expectNoSidewaysScroll(page, path);
    }
  });
});

test.describe("Profile and fields on phones", { tag: "@phone" }, () => {
  test("the Profile says who is signed in", async ({ page }) => {
    await openPage(page, "/profile");

    // In the page, not the sidebar's user block, which is hidden at this width. The fixture signs up as "E2E User".
    const main = page.locator("main");
    await expect(main.getByText("Logged in as")).toBeVisible();
    await expect(main.getByText("E2E User", { exact: true })).toBeVisible();
  });

  test("the body weight form and Complete are phone-sized", async ({ page }) => {
    await openPage(page, "/profile");
    await expectTouchSize(page.getByLabel("Date"), "Date");
    await expectTouchSize(page.getByLabel("Weight in pounds"), "Weight in pounds");
    await expectTouchSize(page.getByRole("button", { name: "Record" }), "Record");

    await openPage(page, "/current-workout");
    await page.getByRole("button", { name: "Start Workout" }).click();
    const complete = page.getByRole("button", { name: "Complete", exact: true });
    await expect(complete).toBeVisible();
    expect((await complete.boundingBox())!.height, "Complete: 44 px tall").toBe(44);
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
  await expect(mainNav(page).getByText("Logged in as")).toBeVisible();
});
