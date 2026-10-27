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
  },
});
