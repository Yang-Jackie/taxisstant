// Package 2a tests — FuelStationAdapter: petrol stations (FR-1.1.3) from OpenStreetMap (D12).
// Uses a real Overpass response recorded on 28 Oct 2026 (200 elements). Data © OpenStreetMap contributors, ODbL.
import { describe, expect, it } from "vitest";
import { loadSample } from "../../sample-data/samples.js";
import { brandOf, FuelStationAdapter } from "./FuelStationAdapter.js";

interface Element {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}
const sample = loadSample("fuelStations") as { elements: Element[] };
const adapter = new FuelStationAdapter();

/** Enough real elements to pass the size check, plus the ones a test adds. */
const withExtra = (...extra: Element[]) => ({ elements: [...sample.elements, ...extra] });
const node = (id: number, lat: number, lon: number, tags: Record<string, string>): Element => ({
  type: "node",
  id,
  lat,
  lon,
  tags: { amenity: "fuel", ...tags },
});

describe("FuelStationAdapter", () => {
  describe("declares its own data source", () => {
    it("feeds the FUEL_STATIONS dataset", () => expect(adapter.getDataset()).toBe("FUEL_STATIONS"));
    it("comes from OpenStreetMap's Overpass API (D12)", () => expect(adapter.getSource()).toBe("OSM_OVERPASS"));
    it("asks for every amenity=fuel inside Singapore", () => {
      expect(adapter.getPath()).toContain('area["ISO3166-1"="SG"]');
      expect(adapter.getPath()).toContain('nwr["amenity"="fuel"]');
    });
    it("refreshes once a day (static data, D1)", () => expect(adapter.getRefreshInterval()).toBe(24 * 60 * 60 * 1000));
  });

  describe("prepare()", () => {
    const stations = adapter.prepare(sample);

    it("gives each station its OpenStreetMap element as its id, and a position even for areas (ways)", () => {
      const way = stations.find((s) => s.id.startsWith("way/"))!;
      expect(way.id).toMatch(/^way\/\d+$/);
      expect(way.latitude).toBeGreaterThan(1.1);
      expect(way.longitude).toBeGreaterThan(103.5);
    });

    it("spells every brand one way: ESSO becomes Esso", () => {
      expect(stations.find((s) => s.id === "way/478127131")?.brand).toBe("Esso");
      const brands = new Set(stations.map((s) => s.brand).filter(Boolean));
      expect(
        [...brands].every((b) => ["Shell", "Esso", "Caltex", "SPC", "Sinopec", "Cnergy", "Smart Energy"].includes(b!)),
      ).toBe(true);
    });

    it("drops the extra element when one station is mapped twice (the shop and its canopy)", () => {
      expect(stations.find((s) => s.id === "way/276519230")).toBeUndefined(); // an unnamed canopy 4 m from a named station
      expect(stations.length).toBeLessThan(sample.elements.length);
    });

    it("keeps two different brands even when they are next to each other", () => {
      const result = adapter.prepare(
        withExtra(node(1, 1.2001, 103.6001, { brand: "Shell" }), node(2, 1.2002, 103.6002, { brand: "Esso" })),
      );
      expect(result.filter((s) => ["node/1", "node/2"].includes(s.id))).toHaveLength(2);
    });

    it("keeps two stations of one brand that are far enough apart", () => {
      const result = adapter.prepare(
        withExtra(node(1, 1.2001, 103.6001, { brand: "Shell" }), node(2, 1.2031, 103.6001, { brand: "Shell" })),
      ); // about 330 m apart
      expect(result.filter((s) => ["node/1", "node/2"].includes(s.id))).toHaveLength(2);
    });

    it("leaves out private pumps", () => {
      const result = adapter.prepare(withExtra(node(3, 1.2101, 103.6101, { name: "Depot pump", access: "private" })));
      expect(result.find((s) => s.id === "node/3")).toBeUndefined();
    });

    it("builds an address from OpenStreetMap's parts, and keeps the opening hours where known", () => {
      const result = adapter.prepare(
        withExtra(
          node(4, 1.2201, 103.6201, {
            brand: "Caltex",
            name: "Caltex Test",
            "addr:housenumber": "10",
            "addr:street": "Test Road",
            "addr:postcode": "123456",
            opening_hours: "24/7",
          }),
        ),
      );
      expect(result.find((s) => s.id === "node/4")).toEqual({
        id: "node/4",
        name: "Caltex Test",
        brand: "Caltex",
        latitude: 1.2201,
        longitude: 103.6201,
        address: "10 Test Road, Singapore 123456",
        openingHours: "24/7",
      });
    });

    it("spells a name that only repeats the brand our way (OpenStreetMap has both ESSO and Esso)", () => {
      const result = adapter.prepare(withExtra(node(6, 1.2401, 103.6401, { name: "ESSO", brand: "ESSO" })));
      expect(result.find((s) => s.id === "node/6")).toMatchObject({ name: "Esso", brand: "Esso" });
      expect(stations.filter((s) => s.name.toLowerCase() === "esso").every((s) => s.name === "Esso")).toBe(true);
    });

    it('calls a station with no name and no brand "Fuel station"', () => {
      const result = adapter.prepare(withExtra(node(5, 1.2301, 103.6301, {})));
      expect(result.find((s) => s.id === "node/5")).toEqual({
        id: "node/5",
        name: "Fuel station",
        latitude: 1.2301,
        longitude: 103.6301,
      });
    });

    it("rejects an answer that was cut short", () => {
      expect(() => adapter.prepare({ elements: sample.elements.slice(0, 20) })).toThrow(/expected at least 100/);
    });
  });
});

describe("brandOf", () => {
  it("uses the brand tag, spelt our way", () => {
    expect(brandOf({ brand: "SPC (Singapore Petroleum Company)" })).toBe("SPC");
    expect(brandOf({ brand: "Sinopec Singapore" })).toBe("Sinopec");
  });

  it("falls back to the operator, then the name", () => {
    expect(brandOf({ operator: "SPC" })).toBe("SPC");
    expect(brandOf({ name: "Shell Dunearn" })).toBe("Shell");
    expect(brandOf({ name: "SMART Energy" })).toBe("Smart Energy");
  });

  it("keeps a brand it doesn't know as OpenStreetMap writes it, and has none when nothing says", () => {
    expect(brandOf({ brand: "NewFuel" })).toBe("NewFuel");
    expect(brandOf({ name: "Refuelling Station" })).toBeUndefined();
    expect(brandOf({})).toBeUndefined();
  });
});
