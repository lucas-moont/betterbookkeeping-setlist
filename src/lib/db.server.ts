import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../../prisma/generated/client/client";

/** What a domain module takes as `db`: the client, or a transaction client so the caller can compose operations (ADR 0010). */
export type DbClient = PrismaClient | Prisma.TransactionClient;

function readDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    const message = "DATABASE_URL is not set: the server can't connect to Postgres. Set it in .env or .env.local.";
    // The SSR error page swallows the throw, so log it for whoever reads the server output.
    console.error(message);
    throw new Error(message);
  }
  return url;
}

// Read at module load, not inside getServerSidePrismaClient, to fail as early as possible. The runtime
// loads server modules lazily, so that is the first request that loads this module, not process start.
const databaseUrl = readDatabaseUrl();

let _prismaClient: PrismaClient | null = null;

export const getServerSidePrismaClient = async () => {
  if (typeof window !== "undefined") {
    throw new Error("getServerSidePrismaClient should only be called on the server");
  }
  if (!_prismaClient) {
    const adapter = new PrismaPg({ connectionString: databaseUrl });
    _prismaClient = new PrismaClient({ adapter });
  }
  return _prismaClient;
};
