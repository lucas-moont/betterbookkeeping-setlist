import { test, expect, type Page } from "./fixtures";
import {
  addSet,
  completeWorkout,
  createMovement,
  logCompletedWorkout,
  openPage,
  startWorkout,
  uniqueToken,
} from "./helpers";

/** The Progression card's movement list, as it shows from the lg breakpoint (the default viewport). */
function movementList(page: Page) {
  return page.getByRole("list", { name: "Movements" });
}

function movementButton(page: Page, name: string) {
  return movementList(page).getByRole("button", { name: new RegExp(`^${name} \\d+ Training Days$`) });
}

/** The chart, named after the movement and metric it shows. */
function chart(page: Page, movement: string, metric = "Max Weight") {
  return page.getByRole("img", { name: new RegExp(`^${movement}, ${metric}: `) });
}

test.describe("Progression", () => {
  test("should chart the movement with a completed set", async ({ page }) => {
    const movement = `Bench Press ${uniqueToken()}`;
    await createMovement(page, movement);
    await logCompletedWorkout(page, { movement, weight: 185, reps: 6 });

    await openPage(page, "/workout-history");

    await expect(movementButton(page, movement)).toHaveAttribute("aria-current", "true");
    await expect(chart(page, movement)).toBeVisible();
    // The chart draws in the browser only, so this also checks it rendered after hydration.
    await expect(chart(page, movement).locator(".recharts-line-dots circle")).toHaveCount(1);
    await expect(page.getByText(/^Latest: 185 lb on /)).toBeVisible();
    await expect(page.getByText("One point per Training Day.")).toBeVisible();
  });

  test("should list only movements with a completed set", async ({ page }) => {
    const token = uniqueToken();
    const done = `Back Squat ${token}`;
    const skipped = `Lunge ${token}`;
    await createMovement(page, done);
    await createMovement(page, skipped);
    await startWorkout(page);
    await addSet(page, { movement: done, weight: 225, reps: 5 });
    await addSet(page, { movement: skipped, weight: 50, reps: 10 });
    await page.getByRole("checkbox", { name: `Completed: ${skipped}, set 1, 50 lb × 10` }).click();
    await expect(page.getByRole("region", { name: skipped, exact: true })).toContainText("0 of 1 completed");
    await completeWorkout(page);

    await openPage(page, "/workout-history");

    await expect(movementList(page).getByRole("button")).toHaveText([new RegExp(`^${done}\\s*1 Training Days$`)]);
  });

  test("should say there are no Training Days yet before any set is completed", async ({ page }) => {
    await openPage(page, "/workout-history");

    await expect(page.getByText("No Training Days yet.")).toBeVisible();
    await expect(page.getByText("Complete a set in a workout and your progress shows up here.")).toBeVisible();
  });

  test("should filter the list as the user types, and chart a movement only once picked", async ({ page }) => {
    const token = uniqueToken();
    const squat = `Back Squat ${token}`;
    const bench = `Bench Press ${token}`;
    await createMovement(page, squat);
    await createMovement(page, bench);
    await logCompletedWorkout(page, { movement: squat, weight: 225, reps: 5 });
    await logCompletedWorkout(page, { movement: bench, weight: 185, reps: 6 });
    await openPage(page, "/workout-history");
    // Both have one Training Day: the tie goes to the first by name.
    await expect(chart(page, squat)).toBeVisible();
    const search = page.getByRole("searchbox", { name: "Search movements" });

    await search.fill("BENCH");

    await expect(movementList(page).getByRole("button")).toHaveText([new RegExp(`^${bench}`)]);
    // Filtering never changes the chart.
    await expect(chart(page, squat)).toBeVisible();

    await search.press("Enter");

    await expect(chart(page, bench)).toBeVisible();
    await expect(movementButton(page, bench)).toHaveAttribute("aria-current", "true");

    await search.fill("zzz");
    await expect(page.getByText('No movements match "zzz".')).toBeVisible();
    await search.press("Escape");
    await expect(search).toHaveValue("");
    await expect(movementList(page).getByRole("button")).toHaveCount(2);
    await expect(chart(page, bench)).toBeVisible();
  });

  test("should switch the metric without asking the server again", async ({ page }) => {
    const movement = `Overhead Press ${uniqueToken()}`;
    await createMovement(page, movement);
    await logCompletedWorkout(page, { movement, weight: 95, reps: 8 });
    await openPage(page, "/workout-history");
    await expect(chart(page, movement)).toBeVisible();
    const serverCalls: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("_serverFn")) serverCalls.push(request.url());
    });
    const metrics = page.getByRole("group", { name: "Metric" });

    await metrics.getByRole("button", { name: "Total Reps" }).click();

    await expect(metrics.getByRole("button", { name: "Total Reps" })).toHaveAttribute("aria-pressed", "true");
    await expect(chart(page, movement, "Total Reps")).toBeVisible();
    await expect(page.getByText(/^Latest: 8 on /)).toBeVisible();

    await metrics.getByRole("button", { name: "Total Volume" }).click();

    await expect(page.getByText(/^Latest: 760 lb on /)).toBeVisible();
    expect(serverCalls).toEqual([]);
  });

  test("should pick a movement from the combobox on a phone, by touch or by keyboard", async ({ page }) => {
    const token = uniqueToken();
    const squat = `Back Squat ${token}`;
    const bench = `Bench Press ${token}`;
    await createMovement(page, squat);
    await createMovement(page, bench);
    await logCompletedWorkout(page, { movement: squat, weight: 225, reps: 5 });
    await logCompletedWorkout(page, { movement: bench, weight: 185, reps: 6 });
    await page.setViewportSize({ width: 390, height: 844 });
    await openPage(page, "/workout-history");
    const combobox = page.getByRole("combobox", { name: "Movement" });
    const options = page.getByRole("listbox", { name: "Movements" }).getByRole("option");
    await expect(combobox).toHaveValue(squat);
    // Closed, it points at no list.
    await expect(combobox).not.toHaveAttribute("aria-controls");

    await combobox.click();

    await expect(combobox).toHaveAttribute("aria-expanded", "true");
    await expect(options).toHaveCount(2);
    await expect(options.first()).toHaveAccessibleName(`${squat} 1 Training Days`);

    // The arrows move through the options, and Enter picks the one they rest on.
    await combobox.press("ArrowDown");
    await expect(combobox).toHaveAttribute("aria-activedescendant", (await options.nth(0).getAttribute("id")) ?? "");
    await combobox.press("ArrowDown");
    await expect(combobox).toHaveAttribute("aria-activedescendant", (await options.nth(1).getAttribute("id")) ?? "");
    await combobox.press("Enter");

    await expect(combobox).toHaveValue(bench);
    await expect(combobox).toHaveAttribute("aria-expanded", "false");
    await expect(combobox).toBeFocused();
    await expect(chart(page, bench)).toBeVisible();

    // Typing opens the list too; with nothing active, Enter picks the first match.
    await combobox.fill("squat");
    await expect(combobox).toHaveAttribute("aria-expanded", "true");
    await combobox.press("Enter");
    await expect(combobox).toHaveValue(squat);

    await combobox.fill("zzz");
    await expect(page.getByRole("status").filter({ hasText: 'No movements match "zzz".' })).toBeVisible();
    await combobox.press("Escape");
    await expect(combobox).toHaveValue(squat);
    await expect(combobox).toHaveAttribute("aria-expanded", "false");
    await expect(combobox).toBeFocused();
  });

  test.describe("months later", () => {
    test("should say a period has no Training Days, and show all time on request", async ({ page }) => {
      const movement = `Deadlift ${uniqueToken()}`;
      await createMovement(page, movement);
      await logCompletedWorkout(page, { movement, weight: 315, reps: 3 });
      await monthsLater(page);
      await page.setViewportSize({ width: 390, height: 844 });
      await openPage(page, "/workout-history");
      await expect(chart(page, movement)).toBeVisible();

      await page.getByRole("group", { name: "Period" }).getByRole("button", { name: "3M" }).click();

      await expect(page.getByText(`No Training Days for ${movement} in the last 3 months.`)).toBeVisible();
      await expect(page.getByText(/^Last one: \w{3} \d{1,2}, \d{4}\.$/)).toBeVisible();

      const showAllTime = page.getByRole("button", { name: "Show all time" });
      // A touch target like every other button on a phone.
      expect((await showAllTime.boundingBox())?.height).toBeGreaterThanOrEqual(44);
      await showAllTime.click();

      await expect(chart(page, movement)).toBeVisible();
      await expect(page.getByRole("group", { name: "Period" }).getByRole("button", { name: "All" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });

    test("should shade the time since the last Training Day", async ({ page }) => {
      const movement = `Pull-up ${uniqueToken()}`;
      await createMovement(page, movement);
      await logCompletedWorkout(page, { movement, weight: 0, reps: 8 });
      await monthsLater(page);

      await openPage(page, "/workout-history");

      await expect(chart(page, movement).getByText(`No ${movement} since `)).toBeVisible();
      await expect(page.getByText(`More than 2 weeks without ${movement}`)).toBeVisible();
      // A screen reader hears the open gap with the chart's name.
      await expect(chart(page, movement)).toHaveAccessibleName(
        new RegExp(`, No ${movement} since \\w{3} \\d{1,2}, \\d{4}, \\d+ months so far$`),
      );
      // The chart is one image: recharts' own keyboard layer would add an unnamed stop inside it.
      await expect(chart(page, movement).locator('[role="application"]')).toHaveCount(0);

      // Far from the only point, the band's tooltip says how long it has been.
      const box = await chart(page, movement).boundingBox();
      if (!box) throw new Error("the chart has no box");
      await page.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2);

      await expect(page.getByText(/^\d+ months so far$/)).toBeVisible();
    });
  });
});

test.describe("Progression on a touch screen", () => {
  test.use({ hasTouch: true });

  test("should show a gap's tooltip when its band is tapped", async ({ page }) => {
    const movement = `Chin-up ${uniqueToken()}`;
    await createMovement(page, movement);
    await logCompletedWorkout(page, { movement, weight: 0, reps: 6 });
    await monthsLater(page);
    await openPage(page, "/workout-history");
    const box = await chart(page, movement).boundingBox();
    if (!box) throw new Error("the chart has no box");

    await page.touchscreen.tap(box.x + box.width * 0.6, box.y + box.height / 2);

    await expect(page.getByText(/^\d+ months so far$/)).toBeVisible();
  });
});

/** Moves the browser's clock about six months ahead; the workouts stay on the server's today. */
async function monthsLater(page: Page) {
  await page.clock.setFixedTime(new Date(Date.now() + 200 * 24 * 60 * 60 * 1000));
}
