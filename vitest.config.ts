import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: [
      "node_modules/**",
      ".next/**",
      "coverage/**",
      "test-results/**",
      "e2e/**",
      "vendors/**",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
