// Package 2c tests — CarparkAvailabilityAdapter: free car lots per carpark (D19), from the same LTA feed as carparks.
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadSample } from "../../sample-data/samples.js";
import { CarparkAdapter } from "./CarparkAdapter.js";
import { CarparkAvailabilityAdapter } from "./CarparkAvailabilityAdapter.js";

type Row = Record<string, unknown>;
const rows = loadSample("carparks") as Row[];
const adapter = new CarparkAvailabilityAdapter();

afterEach(() => vi.restoreAllMocks());

describe("CarparkAvailabilityAdapter", () => {
  describe("declares its own data source", () => {
    it("feeds the CARPARK_AVAILABILITY dataset", () => expect(adapter.getDataset()).toBe("CARPARK_AVAILABILITY"));
    it("reads LTA's carpark availability feed", () => {
      expect(adapter.getSource()).toBe("LTA_DATAMALL");
      expect(adapter.getPaths()).toEqual(["/CarParkAvailabilityv2"]);
    });
    it("refreshes every minute, as often as LTA updates it", () => expect(adapter.getRefreshInterval()).toBe(60_000));
  });

  describe("prepare()", () => {
    const availability = adapter.prepare([rows]);

    it("gives free car lots for exactly the carparks in /carparks, joined by the same id", () => {
      const carparks = new CarparkAdapter().prepare([rows]);
      expect(availability.map((a) => a.id)).toEqual(carparks.map((c) => c.id));
    });

    it("reports LTA's free car lots, not motorcycle or heavy-vehicle ones", () => {
      const suntec = rows.find((r) => r.CarParkID === "1" && r.LotType === "C")!;
      expect(availability.find((a) => a.id === "1")).toEqual({ id: "1", availableLots: suntec.AvailableLots });
    });

    it("skips a row whose lot count isn't a whole number of zero or more", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const broken = rows.map((r) => (r.CarParkID === "A2" && r.LotType === "C" ? { ...r, AvailableLots: -3 } : r));
      expect(adapter.prepare([broken]).find((a) => a.id === "A2")).toBeUndefined();
    });

    it("rejects a snapshot whose pages overlapped a lot, like the carpark list", () => {
      expect(() => adapter.prepare([[...rows.slice(0, 1000), ...rows.slice(960, 2575)]])).toThrow(/came twice/);
    });
  });
});
