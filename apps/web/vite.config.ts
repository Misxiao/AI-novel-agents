import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig, loadEnv } from "vite";

const repoRoot = path.resolve(__dirname, "../..");

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, "");
  const apiPort = process.env.API_PORT ?? env.API_PORT ?? "4100";

  return {
    plugins: [react()],
    envDir: repoRoot,
    server: {
      proxy: {
        "/api": `http://127.0.0.1:${apiPort}`,
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
