// Package 2a tests — ChargingStationAdapter: places with EV chargers (FR-1.1.3, D15), from LTA's EV batch file.
// Uses a real batch file recorded on 28 Oct 2026 (2,806 locations), as the facade returns it after following the link.
import { describe, expect, it } from "vitest";
import { loadSample } from "../../sample-data/samples.js";
import { ChargingStationAdapter } from "./ChargingStationAdapter.js";

type Location = Record<string, unknown> & { name: string; address: string; chargingPoints: Record<string, unknown>[] };
const sample = loadSample("chargingStations") as { evLocationsData: Location[] };
const adapter = new ChargingStationAdapter();

/** The real file with its first location replaced. */
const withFirst = (change: (l: Location) => Location) => ({
  evLocationsData: [change(sample.evLocationsData[0]!), ...sample.evLocationsData.slice(1)],
});

describe("ChargingStationAdapter", () => {
  describe("declares its own data source", () => {
    it("feeds the CHARGING_STATIONS dataset", () => expect(adapter.getDataset()).toBe("CHARGING_STATIONS"));
    it("comes from LTA DataMall", () => expect(adapter.getSource()).toBe("LTA_DATAMALL"));
    it("lives at /EVCBatch", () => expect(adapter.getPaths()).toEqual(["/EVCBatch"]));
    it("refreshes once a day (the locations are static data, D1)", () => {
      expect(adapter.getRefreshInterval()).toBe(24 * 60 * 60 * 1000);
    });
  });

  describe("prepare()", () => {
    const stations = adapter.prepare([sample]);

    it("keeps every location, each with an id from its postal code and longitude", () => {
      expect(stations).toHaveLength(sample.evLocationsData.length);
      expect(new Set(stations.map((s) => s.id)).size).toBe(stations.length);
    });

    it("sums up a location's chargers: operators, count, fastest power, DC, plug types", () => {
      expect(stations.find((s) => s.name === "CLARKE QUAY")).toEqual({
        id: "179024:103.846728",
        name: "CLARKE QUAY",
        address: "3E RIVER VALLEY ROAD SINGAPORE 179024",
        latitude: 1.290314,
        longitude: 103.846728,
        operators: ["SP MOBILITY PTE. LTD."],
        chargePoints: 3,
        maxPowerKw: 50,
        hasDcFast: true,
        plugTypes: ["Combo 2", "Type 2"],
      });
    });

    it("lists each operator once, even where several share a location (D15)", () => {
      const holland = stations.find((s) => s.name === "ONE HOLLAND VILLAGE")!;
      expect(holland.operators.length).toBeGreaterThan(1);
      expect(new Set(holland.operators).size).toBe(holland.operators.length);
    });

    it("gives the same result whatever order LTA lists the chargers in, so the ETag only changes with the data", () => {
      const reversed = withFirst((l) => ({ ...l, chargingPoints: [...l.chargingPoints].reverse() }));
      expect(adapter.prepare([reversed])[0]).toEqual(stations[0]);
    });

    it("names an unnamed location by its address (about 4% have no name)", () => {
      expect(stations.find((s) => s.address === "337 WOODLANDS AVENUE 1 SINGAPORE 730337")?.name).toBe(
        "337 WOODLANDS AVENUE 1 SINGAPORE 730337",
      );
    });

    it("ignores power ratings that aren't numbers, and has no maxPowerKw when none is", () => {
      const result = adapter.prepare([
        withFirst((l) => ({
          ...l,
          chargingPoints: l.chargingPoints.map((c) => ({
            ...c,
            plugTypes: (c.plugTypes as Record<string, unknown>[]).map((p) => ({ ...p, powerRating: "" })),
          })),
        })),
      ]);
      expect(result[0]).not.toHaveProperty("maxPowerKw");
    });

    it("rejects a batch file without its list of locations", () => {
      expect(() => adapter.prepare([{ LastUpdatedTime: "2026-10-28 17:15:00" }])).toThrow();
    });

    it("rejects a file that was cut short", () => {
      expect(() => adapter.prepare([{ evLocationsData: sample.evLocationsData.slice(0, 100) }])).toThrow(
        /expected at least 1000/,
      );
    });
  });
});
