import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import viteTsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

const config = defineConfig({
  plugins: [
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tailwindcss(),
    tanstackStart(),
    nitro({
      preset: "node-server",
    }),
    viteReact(),
  ],
  optimizeDeps: {
    // Server-only native module. The dep scanner reads raw imports before TanStack Start strips
    // server code from client modules, and the package's browser entry needs an uninstalled WASM build.
    exclude: ["@node-rs/argon2"],
  },
  build: {
    sourcemap: process.env.ENVIRONMENT === "development" || process.env.ENVIRONMENT === "test",
  },
  server: {
    watch: { usePolling: true },
  },
});

export default config;
