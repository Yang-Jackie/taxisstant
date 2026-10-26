// Runs before every client test file (see `test.setupFiles` in vite.config.ts).
import "@testing-library/jest-dom/vitest"; // adds DOM matchers: toBeInTheDocument(), toHaveAttribute(), …
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import "./boundary/leafletSetup";

// Unmount whatever a test rendered, so the next test starts with an empty page.
afterEach(() => {
  cleanup();
});
