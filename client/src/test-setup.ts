// Runs before every client test file (see `test.setupFiles` in vite.config.ts).
import "@testing-library/jest-dom/vitest"; // adds DOM matchers: toBeInTheDocument(), toHaveAttribute(), …
import { cleanup } from "@testing-library/react";
import "fake-indexeddb/auto"; // jsdom has no IndexedDB; this adds an in-memory one
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach } from "vitest";
import "./boundary/leafletSetup";
import { i18next } from "./boundary/i18n"; // every word, in English and Chinese, before anything renders

// Every test starts with empty browser storage, so saved settings never leak between tests.
beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

// Unmount whatever a test rendered, so the next test starts with an empty page, in English.
afterEach(async () => {
  cleanup();
  await i18next.changeLanguage("en");
  document.documentElement.removeAttribute("lang");
});
