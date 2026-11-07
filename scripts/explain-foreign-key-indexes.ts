// Measures what the foreign-key indexes change, with EXPLAIN ANALYZE before and after, on a throwaway
// database full of data. Run with `bun run db:explain-indexes` while `bun run dev` is up; it prints
// Markdown, ready for a pull request. Pass --keep to leave the database behind for a closer look.
//
// It never touches the app's database: it creates and drops its own, setlist_explain, on the same
// Postgres. "Before" drops the indexes inside a transaction that is rolled back, so both sides run
// against the same rows.
import { execSync } from "node:child_process";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../prisma/generated/client/client";
import * as workouts from "../src/lib/workouts";

const DATABASE = "setlist_explain";
const USERS = 2_000;
const MOVEMENTS_PER_USER = 50;
const COMPLETED_WORKOUTS_PER_USER = 100;
const SETS_PER_WORKOUT = 10;
const TIME_ZONE = "America/Sao_Paulo";

// The indexes the starter code didn't have. The partial one (ADR 0006) also serves the Current
// Workout lookup, so "before" drops it too: otherwise that query would never show a full scan.
const INDEXES = [
  "Set_workoutId_idx",
  "Set_movementId_idx",
  "Workout_userId_completedAt_idx",
  "Workout_one_current_per_user",
];

type Query = { sql: string; params: unknown[] };
/** `afterWithout`: indexes "After" still drops, to show which index takes over without them. */
type Measured = { name: string; note?: string; afterWithout?: string[]; queries: Query[] };

const sourceUrl = process.env.DATABASE_URL;
if (!sourceUrl) throw new Error("DATABASE_URL is not set. Run this next to `bun run dev`, which reads it from .env.");
const explainUrl = Object.assign(new URL(sourceUrl), { pathname: `/${DATABASE}` }).toString();
const keep = process.argv.includes("--keep");

// The admin client only creates and drops the throwaway database.
const admin = new PrismaClient({ adapter: new PrismaPg({ connectionString: sourceUrl }) });

async function dropDatabase() {
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${DATABASE}" WITH (FORCE)`);
}

async function createDatabase(db: PrismaClient) {
  await dropDatabase();
  await admin.$executeRawUnsafe(`CREATE DATABASE "${DATABASE}"`);
  execSync("bunx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: explainUrl }, stdio: "pipe" });
  // Fail now, not after the fill, if a migration renamed one of the indexes this script drops.
  const found = await db.$queryRaw<{ indexname: string }[]>`
    SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname = ANY(${INDEXES})`;
  const missing = INDEXES.filter((index) => !found.some((row) => row.indexname === index));
  if (missing.length > 0) throw new Error(`The migrations don't create ${missing.join(", ")}.`);
}

async function fill(db: PrismaClient) {
  await db.$executeRaw`
    INSERT INTO "User" (id, email, password, "updatedAt")
    SELECT gen_random_uuid(), 'lifter' || u || '@example.com', 'not-a-password-hash', now()
    FROM generate_series(1, ${USERS}::int) AS u`;
  await db.$executeRaw`
    INSERT INTO "Movement" (id, "userId", name, "nameKey")
    SELECT gen_random_uuid(), u.id, 'Movement ' || m, 'movement ' || m
    FROM "User" u, generate_series(1, ${MOVEMENTS_PER_USER}::int) AS m`;
  // Day 0 is each user's Current Workout; the others were completed one per day before it.
  await db.$executeRaw`
    INSERT INTO "Workout" (id, "userId", "startedAt", "completedAt")
    SELECT gen_random_uuid(), u.id,
      now() - d * interval '1 day' - interval '1 hour',
      CASE WHEN d = 0 THEN NULL ELSE now() - d * interval '1 day' END
    FROM "User" u, generate_series(0, ${COMPLETED_WORKOUTS_PER_USER}::int) AS d`;
  // Each Set uses one of its user's Movements, spread by the workout id so every Movement gets some.
  await db.$executeRaw`
    INSERT INTO "Set" (id, "workoutId", "movementId", reps, weight, "createdAt", "completedAt")
    SELECT gen_random_uuid(), w.id,
      m.ids[1 + ((s + (hashtext(w.id) & 2147483647)) % cardinality(m.ids))],
      5 + s % 8, 45 + (s * 10) % 200,
      w."startedAt" + s * interval '3 minutes',
      coalesce(w."completedAt", now())
    FROM "Workout" w
    JOIN (SELECT "userId", array_agg(id) AS ids FROM "Movement" GROUP BY "userId") m ON m."userId" = w."userId",
      generate_series(1, ${SETS_PER_WORKOUT}::int) AS s`;
  await db.$executeRaw`ANALYZE`;
}

class Rollback extends Error {}

/** Runs `work` inside a transaction that is always rolled back. */
async function rolledBack(db: PrismaClient, work: (tx: Prisma.TransactionClient) => Promise<unknown>) {
  try {
    await db.$transaction(
      async (tx) => {
        await work(tx);
        throw new Rollback();
      },
      { timeout: 300_000 },
    );
  } catch (error) {
    if (!(error instanceof Rollback)) throw error;
  }
}

/**
 * EXPLAIN ANALYZE of each query in order, in one transaction that is always rolled back, so a DELETE
 * is measured without deleting anything. The `dropped` indexes go first, in the same transaction, and
 * come back with the rollback.
 */
async function explain(db: PrismaClient, queries: Query[], dropped: string[]): Promise<string[]> {
  const plans: string[] = [];
  await rolledBack(db, async (tx) => {
    for (const index of dropped) await tx.$executeRawUnsafe(`DROP INDEX "${index}"`);
    for (const query of queries) {
      const rows = await tx.$queryRawUnsafe<{ "QUERY PLAN": string }[]>(
        `EXPLAIN (ANALYZE, BUFFERS) ${query.sql}`,
        ...query.params,
      );
      plans.push(rows.map((row) => row["QUERY PLAN"]).join("\n"));
    }
  });
  return plans;
}

/**
 * The plan nodes that read a table or an index, the foreign-key checks a DELETE fires, and the time,
 * for the summary table. The full plans are printed under it.
 */
function summary(plan: string): string {
  const unquote = (name: string) => name.replaceAll('"', "");
  const scans = [
    ...plan.matchAll(
      /((?:Parallel )?(?:Seq Scan|(?:Index|Index Only) Scan(?: Backward)?|Bitmap Index Scan|Bitmap Heap Scan)(?: using \S+)? on \S+)/g,
    ),
  ].map((match) => unquote(match[1]));
  const checks = [...plan.matchAll(/Trigger for constraint (\S+)(?: on \S+)?: time=([\d.]+) calls=(\d+)/g)].map(
    ([, constraint, ms, calls]) => `FK check ${unquote(constraint)}: ${ms} ms for ${calls} rows`,
  );
  const time = plan.match(/Execution Time: ([\d.]+) ms/)?.[1] ?? "?";
  return [...new Set(scans), ...checks, `**${time} ms**`].join("<br>");
}

/** The SQL on one line, cut for the summary table. */
function shortSql(sql: string) {
  const line = sql.replace(/\s+/g, " ");
  return line.length > 90 ? `${line.slice(0, 90)}…` : line;
}

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: explainUrl }),
  log: [{ emit: "event", level: "query" }],
});
// What Prisma sends while `captured` runs: the real SQL behind each module call.
let log: Query[] | null = null;
db.$on("query", (event: Prisma.QueryEvent) => log?.push({ sql: event.query, params: JSON.parse(event.params) }));

/** Runs `work` and returns the SQL statements Prisma sent for it, with their parameters. */
async function captured(work: () => Promise<unknown>): Promise<Query[]> {
  const sent: Query[] = [];
  log = sent;
  try {
    await work();
  } finally {
    log = null;
  }
  return sent.filter((query) => !/^(BEGIN|COMMIT|ROLLBACK)\b/i.test(query.sql));
}

try {
  await createDatabase(db);
  const started = Date.now();
  await fill(db);
  const filledIn = ((Date.now() - started) / 1000).toFixed(0);
  const [counts] = await db.$queryRaw<{ users: bigint; movements: bigint; workouts: bigint; sets: bigint }[]>`
    SELECT (SELECT count(*) FROM "User") AS users, (SELECT count(*) FROM "Movement") AS movements,
           (SELECT count(*) FROM "Workout") AS workouts, (SELECT count(*) FROM "Set") AS sets`;

  const [{ userId, movementId }] = await db.$queryRaw<{ userId: string; movementId: string }[]>`
    SELECT u.id AS "userId", m.id AS "movementId"
    FROM "User" u JOIN "Movement" m ON m."userId" = u.id
    ORDER BY u.email, m."nameKey" LIMIT 1`;
  const toDelete = await db.workout.findMany({
    where: { userId, completedAt: { not: null } },
    orderBy: { completedAt: "asc" },
    take: 5,
    select: { id: true },
  });

  const current = await captured(() => workouts.get(db, userId));
  const measured: Measured[] = [
    {
      name: "Current Workout (`workouts.get`)",
      note: "The Workout lookup uses ADR 0006's partial index, the smallest one that fits; the next row shows the (userId, completedAt) index taking over without it.",
      queries: current,
    },
    {
      name: "Current Workout, without ADR 0006's index",
      afterWithout: ["Workout_one_current_per_user"],
      queries: current.filter((query) => /FROM "public"\."Workout"/.test(query.sql)),
    },
    {
      name: "History (`workouts.history`)",
      note: "The third query reads the Sets' Movements by primary key. For a few dozen ids the planner may prefer a Seq Scan of Movement, with or without the indexes measured here.",
      queries: await captured(() => workouts.history(db, userId)),
    },
    {
      name: "Progression of one Movement",
      note: "No code reads it yet: this is the query ADR 0004 describes, written by hand. Without Added Weight (ADR 0003), a Set's Load is its weight.",
      queries: [
        {
          sql: `SELECT ((w."completedAt" AT TIME ZONE 'UTC') AT TIME ZONE $3)::date AS day,
       max(s.weight) AS "maxWeight", sum(s.reps) AS "totalReps", sum(s.weight * s.reps) AS "totalVolume"
FROM "Set" s JOIN "Workout" w ON w.id = s."workoutId"
WHERE s."movementId" = $1 AND w."userId" = $2 AND w."completedAt" IS NOT NULL AND s."completedAt" IS NOT NULL
GROUP BY day ORDER BY day`,
          params: [movementId, userId, TIME_ZONE],
        },
      ],
    },
    {
      name: `Deleting ${toDelete.length} workouts (\`workouts.deleteWorkouts\`)`,
      note: "Measured inside a transaction that is rolled back.",
      queries: await captured(() =>
        rolledBack(db, (tx) =>
          workouts.deleteWorkouts(
            tx,
            userId,
            toDelete.map((workout) => workout.id),
          ),
        ),
      ),
    },
  ];

  const fence = (language: string, body: string) => ["```" + language, body, "```", ""];
  const out: string[] = [];
  out.push(
    `Throwaway database \`${DATABASE}\`: ${counts.users} users, ${counts.movements} Movements, ${counts.workouts} Workouts, ${counts.sets} Sets (filled in ${filledIn} s). "Before" drops ${INDEXES.map((i) => `\`${i}\``).join(", ")} in a transaction that is rolled back.`,
    "",
    "| Query | SQL | Before | After |",
    "| --- | --- | --- | --- |",
  );
  const details: string[] = [];
  for (const item of measured) {
    const after = await explain(db, item.queries, item.afterWithout ?? []);
    const before = await explain(db, item.queries, INDEXES);
    item.queries.forEach((query, i) => {
      out.push(
        `| ${i === 0 ? item.name : ""} | \`${shortSql(query.sql)}\` | ${summary(before[i])} | ${summary(after[i])} |`,
      );
      details.push(
        `#### ${item.name}, query ${i + 1}${item.note && i === 0 ? `\n\n${item.note}` : ""}`,
        "",
        ...fence("sql", query.sql),
        "Before:",
        "",
        ...fence("text", before[i]),
        "After:",
        "",
        ...fence("text", after[i]),
      );
    });
  }
  console.log([...out, "", "<details><summary>Full plans</summary>", "", ...details, "</details>"].join("\n"));
} finally {
  await db.$disconnect();
  if (!keep) await dropDatabase();
  await admin.$disconnect();
}
