// Package 3 tests — PickupSuggestionStrategy (UC 0009, D28): taxi stands scored by demand ÷ competition.
import type { HotspotDto, TaxiDto, TaxiStandDto } from "@taxisstant/shared";
import { describe, expect, it } from "vitest";
import { ServerDataCache } from "../../cache/ServerDataCache.js";
import { PickupSuggestionStrategy } from "./PickupSuggestionStrategy.js";

const NOW = new Date("2026-10-28T13:00:00Z");
const strategy = new PickupSuggestionStrategy();

// Two stands about 1 km apart, City Hall station right by the first
const cityHallStand: TaxiStandDto = {
  id: "B01",
  name: "Stand by City Hall",
  latitude: 1.2935,
  longitude: 103.8525,
  standType: "Stand",
  isBarrierFree: true,
};
const farStand: TaxiStandDto = {
  id: "B02",
  name: "Stand far away",
  latitude: 1.3035,
  longitude: 103.8525,
  standType: "Stand",
  isBarrierFree: true,
};
const hotspot = (density: HotspotDto["density"], slotEnd = "2026-10-28T12:45:00.000Z"): HotspotDto => ({
  id: "city-hall",
  stationName: "City Hall",
  codes: ["EW13", "NS25"],
  latitude: 1.2931,
  longitude: 103.852,
  density,
  validFrom: new Date(Date.parse(slotEnd) - 600_000).toISOString(),
  validTo: slotEnd,
});
/** `n` empty taxis right at the City Hall stand. */
const taxisAtStand = (n: number): TaxiDto[] =>
  Array.from({ length: n }, () => ({ latitude: 1.2936, longitude: 103.8526 }));

function cacheWith({
  stands = [cityHallStand, farStand],
  taxis = [] as TaxiDto[],
  hotspots = [] as HotspotDto[],
  taxisAsOf = NOW,
} = {}) {
  const cache = new ServerDataCache();
  cache.put("TAXI_STANDS", stands, NOW);
  cache.put("TAXIS", taxis, taxisAsOf);
  cache.put("HOTSPOTS", hotspots, NOW);
  return cache;
}
const site = (sites: ReturnType<typeof strategy.buildSites>, id: string) => sites!.find((s) => s.id === id)!;

describe("PickupSuggestionStrategy", () => {
  it("builds PICKUP_SITES from taxi stands, taxis and hotspots, and rebuilds when any of them changes", () => {
    expect(strategy.getDataset()).toBe("PICKUP_SITES");
    expect(strategy.getInputs()).toEqual(["TAXI_STANDS", "TAXIS", "HOTSPOTS"]);
  });

  it("can't build anything before the taxi stands are loaded", () => {
    expect(strategy.buildSites(new ServerDataCache(), NOW)).toBeUndefined();
  });

  it("scores a stand by the busiest station within 500 m: HIGH 1, MEDIUM 0.6, LOW 0.25", () => {
    for (const [density, score] of [
      ["HIGH", 1],
      ["MEDIUM", 0.6],
      ["LOW", 0.25],
    ] as const) {
      expect(site(strategy.buildSites(cacheWith({ hotspots: [hotspot(density)] }), NOW), "B01").score).toBeCloseTo(
        score,
      );
    }
  });

  it("uses the busiest of several stations nearby", () => {
    const quietNeighbour: HotspotDto = {
      ...hotspot("LOW"),
      id: "raffles-place",
      stationName: "Raffles Place",
      latitude: 1.2937,
      longitude: 103.853,
    };
    const s = site(strategy.buildSites(cacheWith({ hotspots: [quietNeighbour, hotspot("HIGH")] }), NOW), "B01");
    expect(s).toMatchObject({ stationName: "City Hall", crowdDensity: "HIGH", score: 1 });
  });

  it("gives a stand with no station nearby a little demand (0.1)", () => {
    expect(site(strategy.buildSites(cacheWith({ hotspots: [hotspot("HIGH")] }), NOW), "B02")).toMatchObject({
      score: 0.1,
      summary: "No station nearby · no empty taxis nearby",
    });
  });

  it("shares the demand among empty taxis already there: each 5 within 300 m add one more competitor", () => {
    const score = (n: number) =>
      site(strategy.buildSites(cacheWith({ hotspots: [hotspot("HIGH")], taxis: taxisAtStand(n) }), NOW), "B01").score;
    expect(score(0)).toBeCloseTo(1);
    expect(score(5)).toBeCloseTo(0.5);
    expect(score(15)).toBeCloseTo(0.25);
  });

  it("describes the site and keeps the design model's taxiCount and crowdDensity", () => {
    const s = site(strategy.buildSites(cacheWith({ hotspots: [hotspot("HIGH")], taxis: taxisAtStand(3) }), NOW), "B01");
    expect(s).toMatchObject({
      name: "Stand by City Hall",
      taxiCount: 3,
      crowdDensity: "HIGH",
      stationName: "City Hall",
      radius: 300,
    });
    expect(s.summary).toBe("City Hall very crowded · 3 empty taxis nearby");
  });

  it("ignores a crowd level whose slot ended over 30 minutes ago (D22)", () => {
    const stale = hotspot("HIGH", "2026-10-28T12:29:00.000Z");
    expect(site(strategy.buildSites(cacheWith({ hotspots: [stale] }), NOW), "B01").score).toBeCloseTo(0.1);
  });

  it("ignores taxi positions over 5 minutes old (D22)", () => {
    const old = cacheWith({
      hotspots: [hotspot("HIGH")],
      taxis: taxisAtStand(10),
      taxisAsOf: new Date("2026-10-28T12:54:00Z"),
    });
    expect(site(strategy.buildSites(old, NOW), "B01").taxiCount).toBe(0);
  });

  it("lists the best sites first", () => {
    const sites = strategy.buildSites(
      cacheWith({ stands: [farStand, cityHallStand], hotspots: [hotspot("MEDIUM")] }),
      NOW,
    )!;
    expect(sites.map((s) => s.id)).toEqual(["B01", "B02"]); // City Hall's stand first, though it came second
  });
});
