// Development script for Setlist. Usage: bun scripts/dev.ts [up|down]
// Written for Bun rather than bash, so `bun run dev` works the same on Windows, macOS and Linux.

const compose = ["docker", "compose", "-f", "docker-compose.dev.yml"];
const inherit = { stdin: "inherit", stdout: "inherit", stderr: "inherit" } as const;

async function run(cmd: string[], env?: Record<string, string>): Promise<number> {
  return Bun.spawn(cmd, { ...inherit, env: { ...process.env, ...env } }).exited;
}

async function up(): Promise<number> {
  console.log("Shutting down existing services...");
  const down = await run([...compose, "down"]);
  if (down !== 0) return down;

  console.log("Starting full development environment with watch mode...");
  // Keeps src/routeTree.gen.ts up to date on the host, so editors and typecheck see new routes.
  // --bun runs it inside this Bun process tree, so killing it leaves no stray node process behind.
  const tsr = Bun.spawn([process.execPath, "x", "--bun", "tsr", "watch"], inherit);

  // Ctrl+C reaches every process in the terminal, docker compose included, which stops on its own.
  // Ignoring it here keeps this script alive until compose has finished, so tsr is stopped after.
  process.on("SIGINT", () => {});

  // The container runs as the host user, so files it writes stay editable. Windows has no numeric
  // user id; docker-compose.dev.yml then falls back to 1000.
  const ids: Record<string, string> = {};
  const uid = process.getuid?.();
  const gid = process.getgid?.();
  if (uid !== undefined) ids.USER_ID = String(uid);
  if (gid !== undefined) ids.GROUP_ID = String(gid);

  const code = await run([...compose, "watch"], ids);
  tsr.kill();
  await tsr.exited;
  return code;
}

async function main(): Promise<number> {
  switch (process.argv[2]) {
    case "up":
      return up();
    case "down":
      console.log("Shutting down Docker services...");
      return run([...compose, "down"]);
    default:
      console.log("Usage: bun scripts/dev.ts [up|down]");
      console.log("  up        - Start development environment");
      console.log("  down      - Shut down all services");
      return 1;
  }
}

main().then((code) => process.exit(code));
