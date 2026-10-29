import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // `npm run coverage`: how much of the code the tests run, and a floor it mustn't fall below (NF-4). Left out:
    // scripts/ only writes openapi.json, which openapi.test.ts checks.
    coverage: {
      include: ["src/**"],
      exclude: ["src/**/*.test.ts", "scripts/**"],
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 },
    },
  },
});
