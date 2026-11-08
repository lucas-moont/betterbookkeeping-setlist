import { describe, expect, test } from "vitest";
import { clipGaps, fittingLabel, splitAtGaps, visibleGaps, type ChartGap } from "./chart-gaps";
import { dateToTimestamp as t } from "./time-axis";

const gap = (from: string, to: string, open = false): ChartGap => ({
  from,
  to,
  open,
  title: "3 weeks without Bench Press",
  duration: "3 weeks",
  detail: `${from} to ${to}`,
});

describe("clipGaps", () => {
  const window: [number, number] = [t("2026-08-01"), t("2026-11-07")];

  test("keeps a gap inside the window as it is", () => {
    const inside = gap("2026-09-01", "2026-09-22");
    expect(clipGaps([inside], window)).toEqual([{ gap: inside, x1: t("2026-09-01"), x2: t("2026-09-22") }]);
  });

  test("starts a gap that began before the window at the window's start", () => {
    const before = gap("2026-07-01", "2026-08-20");
    expect(clipGaps([before], window)).toEqual([{ gap: before, x1: t("2026-08-01"), x2: t("2026-08-20") }]);
  });

  test("drops a gap that ended before the window", () => {
    expect(clipGaps([gap("2026-06-01", "2026-07-15")], window)).toEqual([]);
  });

  test("ends an open gap at the window's end", () => {
    const open = gap("2026-10-01", "2026-11-07", true);
    expect(clipGaps([open], window)).toEqual([{ gap: open, x1: t("2026-10-01"), x2: t("2026-11-07") }]);
  });
});

describe("visibleGaps", () => {
  const points = [{ date: "2026-10-01" }, { date: "2026-10-20" }];
  const before = gap("2026-06-01", "2026-07-01");
  const between = gap("2026-10-01", "2026-10-20");
  const open = gap("2026-10-20", "2026-11-07", true);

  test("are the gaps inside the axis that runs from the first point to today", () => {
    expect(visibleGaps(points, "2026-11-07", undefined, [before, between, open]).map((band) => band.gap)).toEqual([
      between,
      open,
    ]);
  });

  test("start at the period's start when one is given", () => {
    const [band] = visibleGaps(points, "2026-11-07", "2026-06-15", [before]);
    expect(band).toEqual({ gap: before, x1: t("2026-06-15"), x2: t("2026-07-01") });
  });
});

describe("fittingLabel", () => {
  const labels = ["3 weeks without Bench Press", "3 weeks"];

  test("is the full label when the band is wide enough for it", () => {
    expect(fittingLabel(200, labels)).toBe("3 weeks without Bench Press");
  });

  test("falls back to the duration in a narrower band", () => {
    expect(fittingLabel(80, labels)).toBe("3 weeks");
  });

  test("is nothing in a band too narrow for any label", () => {
    expect(fittingLabel(40, labels)).toBeUndefined();
  });
});

describe("splitAtGaps", () => {
  const points = [
    { date: "2026-09-01", value: 100 },
    { date: "2026-09-22", value: 110 },
    { date: "2026-09-29", value: 115 },
  ];

  test("breaks the line in the middle of each closed gap and bridges it with its two points", () => {
    const { rows, bridges } = splitAtGaps(points, [gap("2026-09-01", "2026-09-22")]);

    expect(rows.map((row) => [row.t, row.value])).toEqual([
      [t("2026-09-01"), 100],
      [(t("2026-09-01") + t("2026-09-22")) / 2, null],
      [t("2026-09-22"), 110],
      [t("2026-09-29"), 115],
    ]);
    expect(bridges).toEqual([
      [
        { t: t("2026-09-01"), value: 100 },
        { t: t("2026-09-22"), value: 110 },
      ],
    ]);
  });

  test("leaves the line whole for an open gap, which has no point on its right", () => {
    const { rows, bridges } = splitAtGaps(points, [gap("2026-09-29", "2026-11-07", true)]);

    expect(rows.map((row) => row.value)).toEqual([100, 110, 115]);
    expect(bridges).toEqual([]);
  });

  test("bridges a gap whose left point is before the window from the window's first point", () => {
    // The 3M window starts after the gap's left Training Day: the band shows, the bridge has no left end.
    const { bridges } = splitAtGaps(points.slice(1), [gap("2026-08-01", "2026-09-22")]);

    expect(bridges).toEqual([]);
  });
});
