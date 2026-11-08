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

/** What editing a Movement can change. Whatever is left out stays as it is. */
export type MovementChanges = { name?: string; isBodyWeight?: boolean; muscleGroup?: MuscleGroup | null };

/**
 * Edits the user's Movement: its name, its body-weight flag and its Muscle Group, in one write. A
 * name must already be valid (movementNameSchema); the name of another of the user's Movements,
 * ignoring case and the whitespace around it, returns movement-name-taken, and changing only the
 * case of its own name is allowed. Another user's Movement gets the same movement-not-found as one
 * that doesn't exist (ADR 0001).
 *
 * The new name shows in every Set of the Movement, old ones included, because Sets read the name
 * from the Movement. The flag doesn't touch any Set: Load never reads it, so it only changes the
 * Sets logged afterwards (ADR 0003).
 */
export const update = createServerOnlyFn(
  async (
    db: DbClient,
    userId: string,
    movementId: string,
    { name, isBodyWeight, muscleGroup }: MovementChanges,
  ): Promise<Result<{ movement: Movement }, "movement-name-taken" | "movement-not-found">> => {
    const trimmed = name?.trim();
    const nameKey = trimmed === undefined ? undefined : movementNameKey(trimmed);

    // Check first, then write. A rename that hits the unique (userId, nameKey) index throws P2002,
    // and catching it would abort a transaction the caller passed in as db (ADR 0006). Postgres has
    // no UPDATE ... ON CONFLICT, so one read answers both questions: is the Movement the user's, and
    // does another of their Movements already have the name? Two tabs renaming two Movements to the
    // same name at once can both pass the check; the index still refuses the second, which throws
    // and gets the generic error, and no name is ever duplicated.
    const rows = await db.movement.findMany({
      where: { userId, OR: [{ id: movementId }, ...(nameKey === undefined ? [] : [{ nameKey }])] },
      select: { id: true },
    });
    if (!rows.some((row) => row.id === movementId)) return { ok: false, reason: "movement-not-found" };
    if (rows.some((row) => row.id !== movementId)) return { ok: false, reason: "movement-name-taken" };

    // Movements are never deleted and never change owner, so the row the check found is still there.
    const movement = await db.movement.update({
      where: { id: movementId, userId },
      data: { name: trimmed, nameKey, isBodyWeight, muscleGroup },
      select: movementSelect,
    });
    return { ok: true, movement };
  },
);

/**
 * Gives the user's Movement a Muscle Group, changes it, or takes it away (null): the select on each
 * row of the Movements page. Every Workout that used the Movement follows, old ones included,
 * because a Workout's Muscle Groups are read, never stored (ADR 0011). Another user's Movement gets
 * the same movement-not-found as one that doesn't exist (ADR 0001).
 */
export const setMuscleGroup = createServerOnlyFn(
  async (
    db: DbClient,
    userId: string,
    movementId: string,
    muscleGroup: MuscleGroup | null,
  ): Promise<Result<object, "movement-not-found">> => {
    // Without a name, update can't answer movement-name-taken.
    const result = await update(db, userId, movementId, { muscleGroup });
    return result.ok ? { ok: true } : { ok: false, reason: "movement-not-found" };
  },
);

/**
 * Checks that the Movement exists and belongs to the user, and returns it. Another user's Movement
 * gets the same movement-not-found as one that doesn't exist, so callers can't reveal which ids are
 * taken.
 */
export const ensureOwned = createServerOnlyFn(
  async (
    db: DbClient,
    userId: string,
    movementId: string,
  ): Promise<Result<{ movement: Movement }, "movement-not-found">> => {
    const movement = await db.movement.findFirst({ where: { id: movementId, userId }, select: movementSelect });
    return movement ? { ok: true, movement } : { ok: false, reason: "movement-not-found" };
  },
);
