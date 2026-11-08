import { describe, expect, test } from "vitest";
import type { ProgressionMovement, TrainingDayMetrics } from "@/lib/progression";
import { chartGaps, defaultMovement, matchMovements, metricPoints, periodStart } from "./progression";

const movement = (name: string, trainingDays: number): ProgressionMovement => ({
  id: name,
  name,
  isBodyWeight: false,
  trainingDays,
});

const day = (date: string, maxWeight: number, workouts = 1): TrainingDayMetrics => ({
  date,
  maxWeight,
  totalReps: 20,
  totalVolume: maxWeight * 20,
  workouts,
});

describe("defaultMovement", () => {
  test("is the Movement with the most Training Days", () => {
    expect(defaultMovement([movement("Back Squat", 4), movement("Bench Press", 9), movement("Curl", 2)])?.name).toBe(
      "Bench Press",
    );
  });

  test("breaks a tie by name order", () => {
    expect(defaultMovement([movement("Curl", 5), movement("Bench Press", 5)])?.name).toBe("Bench Press");
  });

  test("is nothing without Movements", () => {
    expect(defaultMovement([])).toBeUndefined();
  });
});

describe("matchMovements", () => {
  const list = [movement("Back Squat", 1), movement("Bench Press", 1), movement("Front Squat", 1)];

  test("keeps the Movements whose name holds the text, ignoring case", () => {
    expect(matchMovements(list, "SQU").map((m) => m.name)).toEqual(["Back Squat", "Front Squat"]);
  });

  test("keeps every Movement for blank text", () => {
    expect(matchMovements(list, "  ")).toHaveLength(3);
  });
});

describe("periodStart", () => {
  test("goes back 91 days for 3M and 365 for 1Y", () => {
    expect(periodStart("3m", "2026-11-07")).toBe("2026-08-08");
    expect(periodStart("1y", "2026-11-07")).toBe("2025-11-07");
  });

  test("has no start for All", () => {
    expect(periodStart("all", "2026-11-07")).toBeUndefined();
  });
});

describe("metricPoints", () => {
  test("takes the Metric of each Training Day in the period and notes combined workouts", () => {
    const days = [day("2026-07-01", 175), day("2026-09-01", 185, 2), day("2026-10-01", 190)];

    expect(metricPoints(days, "maxWeight", "2026-08-08")).toEqual([
      { date: "2026-09-01", value: 185, note: "2 workouts combined" },
      { date: "2026-10-01", value: 190 },
    ]);
  });

  test("takes every Training Day without a start", () => {
    expect(metricPoints([day("2026-07-01", 175)], "totalReps", undefined)).toEqual([{ date: "2026-07-01", value: 20 }]);
  });
});

describe("chartGaps", () => {
  test("words a closed gap by its length and dates", () => {
    expect(chartGaps(["2026-03-11", "2026-04-01", "2026-04-05"], "2026-04-10", "Bench Press")).toEqual([
      {
        from: "2026-03-11",
        to: "2026-04-01",
        open: false,
        title: "3 weeks without Bench Press",
        duration: "3 weeks",
        detail: "Mar 11, 2026 to Apr 1, 2026",
      },
    ]);
  });

  test("words an open gap from its last Training Day, so far", () => {
    expect(chartGaps(["2026-06-03"], "2026-11-07", "Overhead Press")).toEqual([
      {
        from: "2026-06-03",
        to: "2026-11-07",
        open: true,
        title: "No Overhead Press since Jun 3, 2026",
        duration: "5 months",
        detail: "5 months so far",
      },
    ]);
  });
});
