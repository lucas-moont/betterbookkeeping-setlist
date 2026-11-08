import { z } from "zod";

// The rules of a page of the workout history. Free of server code, so the module, the server
// function's inputValidator, the query and the history route's ?pageSize= share one definition.

/** How many Completed Workouts a page of the history shows, unless the route asks for another size. */
export const historyPageSize = 20;

/** The largest page the history gives. */
export const maxHistoryPageSize = 50;

export const historyPageSizeSchema = z.int().min(1).max(maxHistoryPageSize);

/** Where a page of the history starts: right after this workout. completedAt is an ISO string. */
export const historyCursorSchema = z.object({ completedAt: z.iso.datetime(), id: z.uuid() });

export type HistoryCursor = z.infer<typeof historyCursorSchema>;
