import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// https://vite.dev/config/  ·  https://vitest.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { "/api": "http://localhost:3000" },
  },
  test: {
    environment: "jsdom", // a simulated browser (document, window, clicks) for component tests
    setupFiles: ["./src/test-setup.ts"],
    // Far from Singapore (UTC+8), so code that forgets to count days in Singapore time fails its tests
    env: { TZ: "America/Los_Angeles" },
    // `npm run coverage`: how much of the code the tests run, and a floor it mustn't fall below (NF-4). Left out: the
    // entry point (main.tsx) only renders App, which App.test.tsx starts the same way; testing/ is test helpers.
    coverage: {
      include: ["src/**"],
      exclude: ["src/**/*.test.*", "src/testing/**", "src/test-setup.ts", "src/main.tsx"],
      thresholds: { statements: 95, branches: 90, functions: 95, lines: 95 },
    },
  },
});
