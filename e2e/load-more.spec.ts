import { test, expect, type Page } from "./fixtures";
import { createMovement, historyRows, logCompletedWorkout, openPage, uniqueToken } from "./helpers";

// The history shows one page of Completed Workouts and loads the next with "Load more". The hidden
// ?pageSize= search param makes a page small, so three workouts are enough to need a second page.

/** Logs three workouts, one set each, 101, 102 and 103 lb: the history lists them 103 first. */
async function logThreeWorkouts(page: Page) {
  const movement = `Bench Press ${uniqueToken()}`;
  await createMovement(page, movement);
  for (const weight of [101, 102, 103]) await logCompletedWorkout(page, { movement, weight, reps: 5 });
}

function loadMore(page: Page) {
  return page.getByRole("button", { name: "Load more" });
}

function selectAll(page: Page) {
  return page.getByRole("checkbox", { name: "Select all loaded workouts" });
}

/** The bulk delete button, with how many workouts it will delete. */
function deleteSelected(page: Page, count: number) {
  return page.getByRole("button", { name: `Delete Selected (${count})` });
}

test.describe("Load more", () => {
  test("shows one page, then the rest, and the button goes away", async ({ page }) => {
    await logThreeWorkouts(page);
    await openPage(page, "/workout-history?pageSize=2");
    await expect(historyRows(page)).toHaveText([/103 lb/, /102 lb/]);

    await loadMore(page).click();

    await expect(historyRows(page)).toHaveText([/103 lb/, /102 lb/, /101 lb/]);
    await expect(loadMore(page)).toBeHidden();
  });

  // The button disappears with the last page; the keyboard focus goes to the first row it brought,
  // not back to the top of the page.
  test("moves the focus to the first new row when the last page arrives", async ({ page }) => {
    await logThreeWorkouts(page);
    await openPage(page, "/workout-history?pageSize=2");

    await loadMore(page).focus();
    await page.keyboard.press("Enter");

    await expect(loadMore(page)).toBeHidden();
    await expect(historyRows(page).filter({ hasText: "101 lb" }).getByRole("checkbox")).toBeFocused();
  });

  test("says when a page fails to load, and the button tries again", async ({ page }) => {
    // The query's retries, about 7 s of backoff, come on top of logging three workouts.
    test.slow();
    await logThreeWorkouts(page);
    await openPage(page, "/workout-history?pageSize=2");
    // Every server function call fails until unrouted: once the page is open, the only one left is
    // Load more's. The query retries a failed page a few times before it gives up.
    await page.route("**/_serverFn/**", (route) => route.fulfill({ status: 500, body: "down" }));

    await loadMore(page).click();

    await expect(page.getByRole("alert").filter({ hasText: "Couldn't load more workouts." })).toBeVisible({
      timeout: 20_000,
    });
    await expect(historyRows(page)).toHaveText([/103 lb/, /102 lb/]);
    await page.unroute("**/_serverFn/**");
    await loadMore(page).click();
    await expect(historyRows(page)).toHaveText([/103 lb/, /102 lb/, /101 lb/]);
    await expect(page.getByText("Couldn't load more workouts.")).toBeHidden();
  });

  test("has no button when every workout fits on the first page", async ({ page }) => {
    await logThreeWorkouts(page);
    await openPage(page, "/workout-history");

    await expect(historyRows(page)).toHaveCount(3);
    await expect(loadMore(page)).toBeHidden();
  });

  test("deletes workouts selected on both pages", async ({ page }) => {
    await logThreeWorkouts(page);
    await openPage(page, "/workout-history?pageSize=2");
    await historyRows(page).filter({ hasText: "103 lb" }).getByRole("checkbox").check();
    await loadMore(page).click();
    await historyRows(page).filter({ hasText: "101 lb" }).getByRole("checkbox").check();

    await deleteSelected(page, 2).click();

    await expect(historyRows(page)).toHaveText([/102 lb/]);
    // The deletion was saved, not just hidden.
    await openPage(page, "/workout-history?pageSize=2");
    await expect(historyRows(page)).toHaveText([/102 lb/]);
  });

  test("Select all marks only the workouts already loaded", async ({ page }) => {
    await logThreeWorkouts(page);
    await openPage(page, "/workout-history?pageSize=2");

    await selectAll(page).check();
    await expect(deleteSelected(page, 2)).toBeVisible();
    await loadMore(page).click();

    await expect(historyRows(page)).toHaveCount(3);
    await expect(selectAll(page)).not.toBeChecked();
    await expect(historyRows(page).filter({ hasText: "101 lb" }).getByRole("checkbox")).not.toBeChecked();
    await deleteSelected(page, 2).click();
    await expect(historyRows(page)).toHaveText([/101 lb/]);
  });
});
