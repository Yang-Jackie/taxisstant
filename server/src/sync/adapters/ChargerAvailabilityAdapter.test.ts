// Package 2c tests — ChargerAvailabilityAdapter: free chargers per place, from the same LTA batch file as the stations.
import { describe, expect, it } from "vitest";
import { loadSample } from "../../sample-data/samples.js";
import { ChargerAvailabilityAdapter } from "./ChargerAvailabilityAdapter.js";
import { ChargingStationAdapter } from "./ChargingStationAdapter.js";

type Location = Record<string, unknown> & { chargingPoints: { status: string }[] };
const sample = loadSample("chargingStations") as { evLocationsData: Location[] };
const adapter = new ChargerAvailabilityAdapter();

describe("ChargerAvailabilityAdapter", () => {
  describe("declares its own data source", () => {
    it("feeds the CHARGER_AVAILABILITY dataset", () => expect(adapter.getDataset()).toBe("CHARGER_AVAILABILITY"));
    it("reads LTA's EV batch file", () => {
      expect(adapter.getSource()).toBe("LTA_DATAMALL");
      expect(adapter.getPaths()).toEqual(["/EVCBatch"]);
    });
    it("refreshes every 5 minutes, as often as LTA updates the file", () =>
      expect(adapter.getRefreshInterval()).toBe(300_000));
  });

  describe("prepare()", () => {
    const availability = adapter.prepare([sample]);
    const stations = new ChargingStationAdapter().prepare([sample]);

    it("gives free chargers for exactly the places in /charging-stations, joined by the same id", () => {
      expect(availability.map((a) => a.id)).toEqual(stations.map((s) => s.id));
    });

    it("counts only chargers LTA reports as available (status 1), never more than a place has", () => {
      const first = sample.evLocationsData[0]!;
      const expected = first.chargingPoints.filter((c) => c.status === "1").length;
      expect(availability[0]!.availablePoints).toBe(expected);
      stations.forEach((s, i) => expect(availability[i]!.availablePoints).toBeLessThanOrEqual(s.chargePoints));
    });

    it("doesn't count occupied (0), out-of-service (100) or unknown chargers", () => {
      const statuses = ["1", "0", "100", "", "1"];
      const place = {
        ...sample.evLocationsData[0]!,
        chargingPoints: statuses.map((status) => ({ ...sample.evLocationsData[0]!.chargingPoints[0], status })),
      };
      const result = adapter.prepare([{ evLocationsData: [place, ...sample.evLocationsData.slice(1)] }]);
      expect(result[0]!.availablePoints).toBe(2);
    });
  });
});
