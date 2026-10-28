// Package 2c tests — TaxiAdapter: where the available taxis are (FR-1.2.2), from data.gov.sg in one snapshot.
// Uses a real response recorded on 28 Oct 2026.
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadSample } from "../../sample-data/samples.js";
import { TaxiAdapter } from "./TaxiAdapter.js";

type Answer = { features: { geometry: { type: string; coordinates: [number, number][] } }[] };
const sample = loadSample("taxis") as Answer;
const adapter = new TaxiAdapter();
const withCoordinates = (coordinates: unknown[]) => ({
  ...sample,
  features: [{ ...sample.features[0], geometry: { type: "MultiPoint", coordinates } }],
});

afterEach(() => vi.restoreAllMocks());

describe("TaxiAdapter", () => {
  describe("declares its own data source", () => {
    it("feeds the TAXIS dataset", () => expect(adapter.getDataset()).toBe("TAXIS"));
    it("comes from data.gov.sg's real-time API, as the deployment diagram says", () => {
      expect(adapter.getSource()).toBe("DATA_GOV_SG");
      expect(adapter.getPaths()).toEqual(["/v1/transport/taxi-availability"]);
    });
    it("refreshes every 30 seconds (the deployment diagram)", () => expect(adapter.getRefreshInterval()).toBe(30_000));
  });

  describe("prepare()", () => {
    const taxis = adapter.prepare([sample]);

    it("keeps every taxi, turning GeoJSON's [longitude, latitude] into named fields", () => {
      expect(taxis).toHaveLength(sample.features[0]!.geometry.coordinates.length);
      const [lon, lat] = sample.features[0]!.geometry.coordinates[0]!;
      expect(taxis[0]!.latitude).toBeCloseTo(lat, 5);
      expect(taxis[0]!.longitude).toBeCloseTo(lon, 5);
      expect(taxis[0]!.latitude).toBeLessThan(2); // not swapped: Singapore is about 1.3° N, 103.8° E
    });

    it("rounds positions to five decimals (about a metre) to keep the response small", () => {
      const result = adapter.prepare([
        withCoordinates([...sample.features[0]!.geometry.coordinates, [103.823456789, 1.312345678]]),
      ]);
      expect(result.at(-1)).toEqual({ latitude: 1.31235, longitude: 103.82346 });
    });

    it("skips a position nowhere near Singapore", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const result = adapter.prepare([withCoordinates([...sample.features[0]!.geometry.coordinates, [0, 0]])]);
      expect(result).toHaveLength(taxis.length);
    });

    it("rejects an answer of the wrong shape, or one that was cut short", () => {
      expect(() => adapter.prepare([{ features: [] }])).toThrow();
      expect(() => adapter.prepare([withCoordinates(sample.features[0]!.geometry.coordinates.slice(0, 10))])).toThrow(
        /at least 100/,
      );
    });
  });
});
