import { test, expect, type Page } from "./fixtures";
import { navLink, openPage } from "./helpers";

// A slow page shows an outline of itself while its loader runs, after the router's one-second wait;
// a fast one never shows it.

/** What the outline says to a screen reader while it's on screen. */
const loadingText = "Loading…";

function pending(page: Page) {
  return page.getByRole("status").filter({ hasText: loadingText });
}

test.describe("Loading between pages", () => {
  test("a slow page shows its outline until the data arrives", async ({ page }) => {
    await openPage(page, "/current-workout");
    // The history's server functions answer two and a half seconds late.
    await page.route("**/_serverFn/**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      await route.continue();
    });

    await navLink(page, "history").click();

    await expect(pending(page)).toBeAttached();
    await expect(page.getByRole("heading", { name: "Workout History" })).toBeVisible({ timeout: 10_000 });
    await expect(pending(page)).toHaveCount(0);
    // No delayed request outlives the test.
    await page.unroute("**/_serverFn/**", { behavior: "wait" });
  });

  test("a fast page never shows it", async ({ page }) => {
    await openPage(page, "/current-workout");
    // Records, in the page, whether the outline's status ever said it was loading.
    await page.evaluate((text) => {
      new MutationObserver(() => {
        const statuses = [...document.querySelectorAll('[role="status"]')];
        if (statuses.some((status) => status.textContent === text)) document.body.dataset.sawPending = "true";
      }).observe(document.body, { childList: true, subtree: true, characterData: true });
    }, loadingText);

    await navLink(page, "movements").click();

    await expect(page.getByRole("heading", { name: "Movements", level: 1 })).toBeVisible();
    await expect(page.locator("body")).not.toHaveAttribute("data-saw-pending");
  });
});
