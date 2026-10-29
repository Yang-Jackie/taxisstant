import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // `npm run coverage`: how much of the code the tests run, and a floor it mustn't fall below (NF-4). Left out:
    // the entry point (DataServiceApp.ts) only wires up what dataSources.test.ts checks; build-stations.ts is a
    // script run by hand; sample-data/ is recorded test input.
    coverage: {
      include: ["src/**"],
      exclude: [
        "src/**/*.test.ts",
        "src/sample-data/**",
        "src/DataServiceApp.ts",
        "src/reference-data/build-stations.ts",
      ],
      thresholds: { statements: 95, branches: 90, functions: 95, lines: 95 },
    },
  },
});
