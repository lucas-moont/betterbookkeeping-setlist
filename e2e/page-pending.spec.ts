import { test, expect, type Page } from "./fixtures";
import { navLink, openPage } from "./helpers";

// A slow page shows an outline of itself while its loader runs, after the router's one-second wait;
// a fast one never shows it.

function pending(page: Page) {
  return page.locator('main [aria-busy="true"]');
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

    await expect(pending(page)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Workout History" })).toBeVisible({ timeout: 10_000 });
    await expect(pending(page)).toHaveCount(0);
  });

  test("a fast page never shows it", async ({ page }) => {
    await openPage(page, "/current-workout");
    // Records whether the outline was ever on screen during the navigation.
    await page.evaluate(() => {
      const seen = { pending: false };
      (window as unknown as { __pending: typeof seen }).__pending = seen;
      new MutationObserver(() => {
        if (document.querySelector('main [aria-busy="true"]')) seen.pending = true;
      }).observe(document.body, { childList: true, subtree: true });
    });

    await navLink(page, "movements").click();

    await expect(page.getByRole("heading", { name: "Movements", level: 1 })).toBeVisible();
    expect(
      await page.evaluate(() => (window as unknown as { __pending: { pending: boolean } }).__pending.pending),
    ).toBe(false);
  });
});
