import { readdirSync } from "node:fs";
import path from "node:path";

/** Where Prisma keeps the migrations, each in a folder named `<timestamp>_<name>`. */
export const migrationsDir = path.resolve("prisma/migrations");

/** Every migration folder, oldest first: the order `prisma migrate deploy` applies them in. */
export function migrationFolders(): string[] {
  return readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/** The path to the migration.sql of the migration with this name, whatever its timestamp. */
export function migrationSqlPath(name: string): string {
  const folder = migrationFolders().find((folder) => folder.endsWith(`_${name}`));
  if (!folder) throw new Error(`No migration folder ends in _${name}`);
  return path.join(migrationsDir, folder, "migration.sql");
}
