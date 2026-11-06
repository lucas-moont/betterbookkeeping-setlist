import { createServerOnlyFn } from "@tanstack/react-start";
import type { DbClient } from "@/lib/db.server";
import type { Result } from "@/lib/error-codes";
import { movementNameKey } from "./name";

// The movements module (ADR 0010): each user's own library of Movements (ADR 0001). Every operation
// takes (db, userId, ...) and only ever touches that user's rows. Every write to name goes through
// here, so nameKey is always movementNameKey(name).

export type Movement = { id: string; name: string };

// Only the columns the screens use, so userId and nameKey stay on the server.
const movementSelect = { id: true, name: true } as const;

/**
 * Adds a Movement to the user's library. The name must already be valid (movementNameSchema). A
 * name the user already has, ignoring case and the whitespace around it, returns movement-name-taken.
 */
export const create = createServerOnlyFn(
  async (
    db: DbClient,
    userId: string,
    name: string,
  ): Promise<Result<{ movement: Movement }, "movement-name-taken">> => {
    // INSERT ... ON CONFLICT DO NOTHING: the unique (userId, nameKey) index decides, so two
    // concurrent creates can't both get in, and nothing throws. A caught P2002 would abort a
    // transaction the caller passed in as db (ADR 0006).
    const [movement] = await db.movement.createManyAndReturn({
      data: [{ userId, name, nameKey: movementNameKey(name) }],
      skipDuplicates: true,
      select: movementSelect,
    });
    return movement ? { ok: true, movement } : { ok: false, reason: "movement-name-taken" };
  },
);

/** The user's Movements, in alphabetical order. */
export const list = createServerOnlyFn(async (db: DbClient, userId: string): Promise<Movement[]> => {
  return db.movement.findMany({ where: { userId }, orderBy: { name: "asc" }, select: movementSelect });
});

/**
 * Checks that the Movement exists and belongs to the user. Another user's Movement gets the same
 * movement-not-found as one that doesn't exist, so callers can't reveal which ids are taken.
 */
export const ensureOwned = createServerOnlyFn(
  async (db: DbClient, userId: string, movementId: string): Promise<Result<object, "movement-not-found">> => {
    const owned = await db.movement.count({ where: { id: movementId, userId } });
    return owned > 0 ? { ok: true } : { ok: false, reason: "movement-not-found" };
  },
);
