import { test, expect, type Page } from "./fixtures";
import { createMovement, logCompletedWorkout, openPage, startWorkout, uniqueToken } from "./helpers";

// UTC+14 and UTC-12: 26 hours apart, so the two are never on the same date, whatever the clock says.
// That makes these tests independent of the time they run at.
const ahead = "Pacific/Kiritimati";
const behind = "Etc/GMT+12";

// Written out here rather than imported from src/lib/format.ts, so the test doesn't check the code
// against itself.
function today(timeZone: string, style: "short" | "long") {
  const options: Intl.DateTimeFormatOptions =
    style === "long"
      ? { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone }
      : { month: "short", day: "numeric", year: "numeric", timeZone };
  return new Intl.DateTimeFormat("en-US", options).format(new Date());
}

// Today as a date field holds it, "YYYY-MM-DD". en-CA writes dates in that order.
function todayIso(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(),
  );
}

// React reports a server render that the browser disagrees with as a hydration error. The production
// build, which CI tests, minifies the message to a code: #418, #419, #422, #423 or #425.
const hydrationError = /hydrat|#4(18|19|22|23|25)\b/i;

function collectHydrationErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && hydrationError.test(message.text())) errors.push(message.text());
  });
  page.on("pageerror", (error) => {
    if (hydrationError.test(error.message)) errors.push(error.message);
  });
  return errors;
}

test("the two zones are never on the same date", () => {
  expect(today(ahead, "long")).not.toBe(today(behind, "long"));
});

for (const timeZone of [ahead, behind]) {
  test.describe(`in ${timeZone}`, () => {
    test.use({ timezoneId: timeZone });

    // The title is the day the workout started, which is today for one started just now.
    test("should show the start date in the Current Workout title, on the server too", async ({ page }) => {
      await startWorkout(page);
      const hydrationErrors = collectHydrationErrors(page);

      const response = await openPage(page, "/current-workout");

      await expect(page.getByText(today(timeZone, "long"))).toBeVisible();
      expect(await response?.text()).toContain(today(timeZone, "long"));
      expect(hydrationErrors).toEqual([]);
    });

    test("should date a completed workout by the browser's day, on the server too", async ({ page }) => {
      const movement = `Deadlift ${uniqueToken()}`;
      await createMovement(page, movement);
      await logCompletedWorkout(page, { movement, weight: 315, reps: 3 });
      const hydrationErrors = collectHydrationErrors(page);

      const response = await openPage(page, "/workout-history");

      await expect(page.getByRole("cell", { name: today(timeZone, "short") })).toBeVisible();
      expect(await response?.text()).toContain(today(timeZone, "short"));
      expect(hydrationErrors).toEqual([]);
    });

    test("should default the body weight date to the browser's today, on the server too", async ({ page }) => {
      const hydrationErrors = collectHydrationErrors(page);

      const response = await openPage(page, "/profile");

      await expect(page.getByLabel("Date")).toHaveValue(todayIso(timeZone));
      expect(await response?.text()).toContain(`value="${todayIso(timeZone)}"`);
      expect(hydrationErrors).toEqual([]);
    });
  });
}

test.describe("on a first visit", () => {
  // Whichever zone is on a different date from UTC right now, so the re-render shows.
  const timeZone = today(ahead, "long") !== today("UTC", "long") ? ahead : behind;
  test.use({ timezoneId: timeZone });

  test("should re-render in the browser's zone as soon as it stores the cookie", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "slows the CPU through the Chrome DevTools Protocol");
    await startWorkout(page);
    // No zone stored yet.
    await page.context().clearCookies({ name: "tz" });
    const hydrationErrors = collectHydrationErrors(page);
    // A slow device: the cookie is stored while the route is still hydrating (ADR 0004).
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

    const response = await page.goto("/current-workout");

    // The server didn't know the zone yet, so it rendered UTC...
    expect(await response?.text()).toContain(today("UTC", "long"));
    // ...and the browser corrected the same page without a navigation.
    await expect(page.getByText(today(timeZone, "long"))).toBeVisible({ timeout: 20_000 });
    const cookies = await page.context().cookies();
    expect(cookies.find((cookie) => cookie.name === "tz")?.value).toBe(encodeURIComponent(timeZone));
    expect(hydrationErrors).toEqual([]);
  });
});
