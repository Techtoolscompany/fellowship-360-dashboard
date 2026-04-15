import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: [
      "src/lib/grace/__tests__/ops-health.test.ts",
      "src/lib/inngest/functions/__tests__/automation-event-dispatcher.test.ts",
      "src/lib/operations/__tests__/appointments-lifecycle.test.ts",
      "src/lib/operations/__tests__/tasks-lifecycle.test.ts",
      "src/lib/operations/__tests__/conversations-lifecycle.test.ts",
      "src/lib/operations/__tests__/contacts-lifecycle.test.ts",
      "src/lib/operations/__tests__/prayer-lifecycle.test.ts",
      "src/app/actions/__tests__/contacts-actions.test.ts",
      "src/app/actions/__tests__/communications-actions.test.ts",
      "src/app/actions/__tests__/automations-actions.test.ts",
      "src/app/actions/__tests__/finances-actions.test.ts",
      "src/app/actions/__tests__/tasks-actions.test.ts",
      "src/app/actions/__tests__/prayer-actions.test.ts",
      "src/app/actions/__tests__/crud-db.integration.test.ts",
      "src/app/api/app/organizations/current/grace/__tests__/config-route.test.ts",
      "src/app/api/app/organizations/current/service-templates/__tests__/routes.test.ts",
    ],
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
