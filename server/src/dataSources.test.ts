// Package 10a-2 tests — the service's wiring: every dataset the API serves is filled by something, and only once.
import { describe, expect, it } from "vitest";
import { ROUTES } from "./api/DataApiController.js";
import { createAdapters, createStrategies } from "./dataSources.js";

const adapters = createAdapters();
const strategies = createStrategies();
const synced = adapters.map((a) => a.getDataset());
const built = strategies.map((s) => s.getDataset());

describe("the data service's sources", () => {
  it("fills every dataset the API serves, with one adapter or one strategy", () => {
    for (const { dataset } of ROUTES) {
      expect(
        [...synced, ...built].filter((d) => d === dataset),
        dataset,
      ).toHaveLength(1);
    }
  });

  it("serves every dataset it fills", () => {
    const served = new Set(ROUTES.map((r) => r.dataset));
    for (const d of [...synced, ...built]) expect(served.has(d), d).toBe(true);
  });

  it("syncs every input a strategy scores from", () => {
    for (const s of strategies) {
      for (const input of s.getInputs()) expect(synced, `${s.getDataset()} reads ${input}`).toContain(input);
    }
  });

  it("refreshes every dataset on a schedule, and asks somewhere for it", () => {
    for (const a of adapters) {
      expect(a.getRefreshInterval(), a.getDataset()).toBeGreaterThan(0);
      expect(a.getPaths().length, a.getDataset()).toBeGreaterThan(0);
    }
  });
});
