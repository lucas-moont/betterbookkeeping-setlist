import { defineConfig } from "vitest/config";
import viteTsConfigPaths from "vite-tsconfig-paths";
import { testDatabaseUrl } from "./src/test/test-database-url";

// Integration tests only (ADR 0008): plain Node, no TanStack Start or Nitro plugins.
// createServerOnlyFn is an identity function at runtime, so domain modules run as they are.
export default defineConfig({
  plugins: [viteTsConfigPaths({ projects: ["./tsconfig.json"] })],
  test: {
    include: ["src/**/*.test.ts"],
    pool: "forks",
    globalSetup: "./src/test/global-setup.ts",
    env: {
      DATABASE_URL: testDatabaseUrl,
      TZ: "UTC",
    },
  },
});
