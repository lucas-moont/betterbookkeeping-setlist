import { test, expect, type Page } from "./fixtures";
import { openPage, signOut, signUpAsNewUser } from "./helpers";

/** Records a body weight from the Profile, on the form's date (today unless the test picked one). */
async function recordBodyWeight(page: Page, weight: number) {
  await page.getByLabel("Weight in pounds").fill(String(weight));
  await page.getByRole("button", { name: /^(Record|Replace)$/ }).click();
  await expect(page.getByRole("status")).toContainText(/^(Recorded|Replaced)/);
}

function entryRows(page: Page) {
  return page.getByRole("listitem");
}

test.describe("Body Weight", () => {
  test("should open the Profile from the signed-in user's block", async ({ page }) => {
    await openPage(page, "/current-workout");

    await page.getByRole("link", { name: /Logged in as/ }).click();

    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
  });

  test("should keep the user's block in view and scroll a Profile taller than the window", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 500 });
    await openPage(page, "/profile");
    await recordBodyWeight(page, 172.4);
    const deleteButton = page.getByRole("button", { name: /^Delete entry for / });
    await expect(page.getByRole("link", { name: /Logged in as/ })).toBeInViewport();
    await expect(deleteButton).not.toBeInViewport();

    // The wheel, not a programmatic scroll: a clipped page still scrolls from code but never by hand.
    await page.getByRole("heading", { name: "Profile" }).hover();
    await page.mouse.wheel(0, 2000);

    await expect(deleteButton).toBeInViewport();
    await expect(page.getByRole("link", { name: /Logged in as/ })).toBeInViewport();
  });

  test("should show a weight recorded today in the list, the Latest line and the chart", async ({ page }) => {
    await openPage(page, "/profile");
    await expect(page.getByText("No body weight recorded yet.")).toBeVisible();

    await recordBodyWeight(page, 172.4);

    await expect(entryRows(page)).toHaveCount(1);
    await expect(entryRows(page).first()).toContainText("172.4 lb");
    await expect(page.getByText(/^Latest: 172\.4 lb on /)).toBeVisible();
    await expect(page.getByRole("img", { name: /^Body weight chart: 1 entry from / })).toBeVisible();
    // The chart draws in the browser only, so this also checks it rendered after hydration.
    await expect(page.locator(".recharts-line-dots circle")).toHaveCount(1);
  });

  test("should replace the weight when recording the same date again", async ({ page }) => {
    await openPage(page, "/profile");
    await recordBodyWeight(page, 172.4);

    await page.getByLabel("Weight in pounds").fill("171.8");
    await expect(page.getByText(/already has 172\.4 lb\. Recording again replaces it\./)).toBeVisible();
    await page.getByRole("button", { name: "Replace" }).click();

    await expect(page.getByRole("status")).toContainText("Replaced the entry for");
    await expect(entryRows(page)).toHaveCount(1);
    await expect(entryRows(page).first()).toContainText("171.8 lb");
  });

  test("should wait until the user starts an entry before warning that today has one", async ({ page }) => {
    await openPage(page, "/profile");
    await recordBodyWeight(page, 172.4);

    // Coming back on a day already recorded is normal: no warning until the user types.
    await openPage(page, "/profile");
    await expect(page.getByRole("button", { name: "Record" })).toBeVisible();
    await expect(page.getByText(/Recording again replaces it\./)).toHaveCount(0);

    await page.getByLabel("Weight in pounds").fill("171.8");

    await expect(page.getByText(/already has 172\.4 lb\. Recording again replaces it\./)).toBeVisible();
    await expect(page.getByRole("button", { name: "Replace" })).toBeVisible();
  });

  test("should refuse a date in the future", async ({ page }) => {
    await openPage(page, "/profile");
    const tomorrow = await page.evaluate(() => {
      const date = new Date();
      date.setDate(date.getDate() + 1);
      return date.toLocaleDateString("en-CA");
    });

    await page.getByLabel("Date").fill(tomorrow);
    await page.getByLabel("Weight in pounds").fill("172.4");
    await page.getByRole("button", { name: "Record" }).click();

    await expect(page.getByText("The date can't be in the future")).toBeVisible();
    await expect(page.getByText("No entries yet.")).toBeVisible();
  });

  test("should delete an entry", async ({ page }) => {
    await openPage(page, "/profile");
    await recordBodyWeight(page, 172.4);

    await page.getByRole("button", { name: /^Delete entry for / }).click();

    await expect(page.getByRole("status")).toContainText("Deleted the entry for");
    await expect(page.getByText("No entries yet.")).toBeVisible();
  });

  test("should not show one user's body weight to another", async ({ page }) => {
    await openPage(page, "/profile");
    await recordBodyWeight(page, 172.4);
    await signOut(page);

    await signUpAsNewUser(page);
    await openPage(page, "/profile");

    await expect(page.getByText("No body weight recorded yet.")).toBeVisible();
    await expect(page.getByText("No entries yet.")).toBeVisible();
  });
});
