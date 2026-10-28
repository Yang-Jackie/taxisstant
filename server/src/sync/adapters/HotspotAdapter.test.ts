// Package 2c tests — HotspotAdapter: how crowded each station is right now (FR-1.2.3, D20), placed with the station file.
// Uses LTA's real-time crowd density for all 11 lines, recorded on 28 Oct 2026, one answer per line (D21).
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadStations } from "../../reference-data/stations.js";
import { loadSample } from "../../sample-data/samples.js";
import { HotspotAdapter, TRAIN_LINES } from "./HotspotAdapter.js";

type Row = { Station: string; StartTime: string; EndTime: string; CrowdLevel: string };
const sample = loadSample("hotspots") as Row[][];
const stations = loadStations();
const adapter = new HotspotAdapter(stations);
const slot = { StartTime: "2026-10-28T20:50:00+08:00", EndTime: "2026-10-28T21:00:00+08:00" };

/** The real answers, with extra rows added to the first line's. */
const withRows = (...rows: Row[]) => [[...sample[0]!, ...rows], ...sample.slice(1)];

afterEach(() => vi.restoreAllMocks());

describe("HotspotAdapter", () => {
  describe("declares its own data source", () => {
    it("feeds the HOTSPOTS dataset", () => expect(adapter.getDataset()).toBe("HOTSPOTS"));
    it("asks LTA's real-time crowd API once per train line (D21)", () => {
      expect(adapter.getSource()).toBe("LTA_DATAMALL");
      expect(adapter.getPaths()).toEqual(TRAIN_LINES.map((l) => `/PCDRealTime?TrainLine=${l}`));
      expect(adapter.getPaths()).toHaveLength(11);
    });
    it("refreshes every 10 minutes, LTA's slot length (D20)", () => expect(adapter.getRefreshInterval()).toBe(600_000));
  });

  describe("prepare()", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const hotspots = adapter.prepare(sample);

    it("gives every open station one hotspot, placed from the station file", () => {
      expect(hotspots.length).toBeGreaterThan(180);
      expect(new Set(hotspots.map((h) => h.id)).size).toBe(hotspots.length);
      const cityHall = hotspots.find((h) => h.id === "city-hall")!;
      expect(cityHall).toMatchObject({
        stationName: "City Hall",
        codes: ["EW13", "NS25"],
        latitude: stations.get("EW13")!.latitude,
      });
    });

    it("turns LTA's l/m/h into the design model's LOW/MEDIUM/HIGH, and gives the slot in UTC", () => {
      for (const h of hotspots) expect(["LOW", "MEDIUM", "HIGH"]).toContain(h.density);
      expect(hotspots[0]!.validFrom).toMatch(/Z$/);
      expect(Date.parse(hotspots[0]!.validTo) - Date.parse(hotspots[0]!.validFrom)).toBe(10 * 60 * 1000);
    });

    it("rates an interchange by its busiest platform (City Hall: EW13 quiet, NS25 busy → HIGH)", () => {
      const lines = sample.map((rows) => rows.filter((r) => r.Station !== "EW13" && r.Station !== "NS25"));
      lines[0]!.push({ Station: "EW13", ...slot, CrowdLevel: "l" }, { Station: "NS25", ...slot, CrowdLevel: "h" });
      expect(adapter.prepare(lines).find((h) => h.id === "city-hall")?.density).toBe("HIGH");
    });

    it("skips stations it can't place (not open yet), and says so only once", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const fresh = new HotspotAdapter(stations);
      fresh.prepare(withRows({ Station: "XX99", ...slot, CrowdLevel: "h" }));
      fresh.prepare(withRows({ Station: "XX99", ...slot, CrowdLevel: "h" }));
      expect(warn.mock.calls.filter(([m]) => String(m).includes("XX99"))).toHaveLength(1);
    });

    it("skips a row with a crowd level it doesn't know, keeping the rest", () => {
      const result = adapter.prepare(withRows({ Station: "EW13", ...slot, CrowdLevel: "x" }));
      expect(result).toHaveLength(hotspots.length);
    });

    it("rejects the sync when most lines answered with nothing", () => {
      expect(() => adapter.prepare([sample[0]!, ...sample.slice(1).map(() => [])])).toThrow(/expected at least 100/);
    });

    it("lists hotspots in a stable order, so the ETag changes only when levels do", () => {
      expect(adapter.prepare([...sample].reverse()).map((h) => h.id)).toEqual(hotspots.map((h) => h.id));
    });
  });
});
