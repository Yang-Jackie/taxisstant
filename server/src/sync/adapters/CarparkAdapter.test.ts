// Package 2a tests — CarparkAdapter: HDB, URA and LTA carparks with car lots (FR-1.1.2), from LTA's availability feed.
// Uses a real LTA response recorded on 28 Oct 2026 (2,615 rows: one per carpark and lot type).
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadSample } from "../../sample-data/samples.js";
import { CarparkAdapter } from "./CarparkAdapter.js";

type Row = Record<string, unknown>;
const rows = loadSample("carparks") as Row[];
const adapter = new CarparkAdapter();

afterEach(() => vi.restoreAllMocks());

describe("CarparkAdapter", () => {
  describe("declares its own data source", () => {
    it("feeds the CARPARKS dataset", () => expect(adapter.getDataset()).toBe("CARPARKS"));
    it("comes from LTA DataMall", () => expect(adapter.getSource()).toBe("LTA_DATAMALL"));
    it("lives at /CarParkAvailabilityv2", () => expect(adapter.getPaths()).toEqual(["/CarParkAvailabilityv2"]));
    it("refreshes once a day (static data, D1)", () => expect(adapter.getRefreshInterval()).toBe(24 * 60 * 60 * 1000));
  });

  describe("prepare()", () => {
    const carparks = adapter.prepare([rows]);

    it("keeps one entry per carpark that has car lots", () => {
      const withCarLots = new Set(rows.filter((r) => r.LotType === "C").map((r) => r.CarParkID));
      expect(carparks).toHaveLength(withCarLots.size);
      expect(new Set(carparks.map((c) => c.id)).size).toBe(carparks.length);
    });

    it("covers all three agencies FR-1.1.2 names", () => {
      expect(new Set(carparks.map((c) => c.agency))).toEqual(new Set(["HDB", "URA", "LTA"]));
    });

    it("drops carparks with only motorcycle or heavy-vehicle lots: taxis can't use them", () => {
      expect(carparks.find((c) => c.id === "D0030")).toBeUndefined(); // heavy-vehicle lots only
    });

    it("splits LTA's 'latitude longitude' text into numbers, and keeps LTA's area only when it has one", () => {
      expect(carparks.find((c) => c.id === "1")).toEqual({
        id: "1",
        name: "Suntec City",
        latitude: 1.29375,
        longitude: 103.85718,
        agency: "LTA",
        area: "Marina",
      });
      expect(carparks.find((c) => c.id === "A2")).not.toHaveProperty("area");
    });

    it("skips a car-lot row without a usable location, keeping the rest", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const broken = rows.map((r) => (r.CarParkID === "A2" ? { ...r, Location: "" } : r));
      const result = adapter.prepare([broken]);
      expect(result.find((c) => c.id === "A2")).toBeUndefined();
      expect(result).toHaveLength(carparks.length - 1);
    });

    it("accepts a snapshot with a row or two repeated (the feed changed mid-read), keeping one of each", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const overlapped = [...rows.slice(0, 1000), ...rows.slice(999, 2614)]; // 1 row twice, 1 lost
      const result = adapter.prepare([overlapped]);
      expect(new Set(result.map((c) => c.id)).size).toBe(result.length);
      expect(result.length).toBeGreaterThanOrEqual(carparks.length - 1);
      expect(warn).toHaveBeenCalledWith(expect.stringMatching(/1 rows came twice/));
    });

    it("rejects a snapshot whose pages overlapped a lot (over 1% of rows repeated: too many carparks lost)", () => {
      const overlapped = [...rows.slice(0, 1000), ...rows.slice(960, 2575)]; // 40 rows twice, 40 lost: same length
      expect(overlapped).toHaveLength(rows.length);
      expect(() => adapter.prepare([overlapped])).toThrow(/40 rows came twice/);
    });

    it("rejects a download that was cut short", () => {
      expect(() => adapter.prepare([rows.slice(0, 500)])).toThrow(/expected at least 1000/);
    });
  });
});
