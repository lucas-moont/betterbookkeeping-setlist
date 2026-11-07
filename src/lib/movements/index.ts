import { createServerOnlyFn } from "@tanstack/react-start";
import type { DbClient } from "@/lib/db.server";
import type { Result } from "@/lib/error-codes";
import type { MuscleGroup } from "./muscle-group";
import { movementNameKey } from "./name";

// The movements module (ADR 0010): each user's own library of Movements (ADR 0001). Every operation
// takes (db, userId, ...) and only ever touches that user's rows. Every write to name goes through
// here, so nameKey is always movementNameKey(name).

export type Movement = { id: string; name: string; muscleGroup: MuscleGroup | null; isBodyWeight: boolean };

/**
 * What creating a Movement takes. A Movement without a Muscle Group counts toward none (ADR 0011),
 * and one that isn't flagged is not a Body-weight Movement.
 */
export type NewMovement = { name: string; muscleGroup?: MuscleGroup | null; isBodyWeight?: boolean };

// Only the columns the screens use, so userId and nameKey stay on the server.
export const movementSelect = { id: true, name: true, muscleGroup: true, isBodyWeight: true } as const;

/**
 * Adds a Movement to the user's library. The name must already be valid (movementNameSchema). A
 * name the user already has, ignoring case and the whitespace around it, returns movement-name-taken.
 */
export const create = createServerOnlyFn(
  async (
    db: DbClient,
    userId: string,
    { name, muscleGroup = null, isBodyWeight = false }: NewMovement,
  ): Promise<Result<{ movement: Movement }, "movement-name-taken">> => {
    // INSERT ... ON CONFLICT DO NOTHING: the unique (userId, nameKey) index decides, so two
    // concurrent creates can't both get in, and nothing throws. A caught P2002 would abort a
    // transaction the caller passed in as db (ADR 0006).
    const [movement] = await db.movement.createManyAndReturn({
      data: [{ userId, name, nameKey: movementNameKey(name), muscleGroup, isBodyWeight }],
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
 * Gives the user's Movement a Muscle Group, changes it, or takes it away (null). Every Workout that
 * used the Movement follows, old ones included, because a Workout's Muscle Groups are read, never
 * stored (ADR 0011). Another user's Movement gets the same movement-not-found as one that doesn't
 * exist (ADR 0001).
 */
export const setMuscleGroup = createServerOnlyFn(
  async (
    db: DbClient,
    userId: string,
    movementId: string,
    muscleGroup: MuscleGroup | null,
  ): Promise<Result<object, "movement-not-found">> => {
    // One statement: the ownership check and the update can't drift apart.
    const { count } = await db.movement.updateMany({ where: { id: movementId, userId }, data: { muscleGroup } });
    return count === 0 ? { ok: false, reason: "movement-not-found" } : { ok: true };
  },
);

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
