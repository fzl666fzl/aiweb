import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
  test: {
    environment: "jsdom",
    exclude: ["**/node_modules/**", "**/.git/**", "tests/e2e/**"],
    fileParallelism: false,
    globals: true,
    maxWorkers: 2,
    passWithNoTests: true,
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 20000,
  },
});
