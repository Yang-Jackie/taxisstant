// Package 3 tests — RestStopSuggestionStrategy (UC 0008, D29): hawker centres scored by food and parking; energy flagged.
import type { CarparkDto, ChargingStationDto, FuelStationDto, HawkerCentreDto } from "@taxisstant/shared";
import { describe, expect, it } from "vitest";
import { ServerDataCache } from "../../cache/ServerDataCache.js";
import { RestStopSuggestionStrategy } from "./RestStopSuggestionStrategy.js";

const NOW = new Date("2026-10-28T05:00:00Z"); // 13:00 in Singapore
const strategy = new RestStopSuggestionStrategy();

/** A centre with full food choice (60 stalls) unless told otherwise. */
const centre = (
  id: string,
  latitude: number,
  closures: HawkerCentreDto["closures"] = [],
  foodStalls = 60,
): HawkerCentreDto => ({
  id,
  name: id,
  address: "",
  latitude,
  longitude: 103.85,
  foodStalls,
  marketStalls: 0,
  closures,
});
const carpark = (id: string, latitude: number): CarparkDto => ({
  id,
  name: id,
  latitude,
  longitude: 103.8501,
  agency: "HDB",
});
const fuel = (latitude: number): FuelStationDto => ({
  id: `node/${latitude}`,
  name: "Shell",
  brand: "Shell",
  latitude,
  longitude: 103.8502,
});
const charger = (id: string, latitude: number): ChargingStationDto => ({
  id,
  name: id,
  address: "",
  latitude,
  longitude: 103.8503,
  operators: ["SP"],
  chargePoints: 4,
  hasDcFast: true,
  plugTypes: ["Combo 2"],
});

function cacheWith(parts: {
  centres?: HawkerCentreDto[];
  carparks?: CarparkDto[];
  lots?: { id: string; availableLots: number }[] | undefined;
  fuel?: FuelStationDto[];
  chargers?: ChargingStationDto[];
  points?: { id: string; availablePoints: number }[];
  lotsAsOf?: Date;
}) {
  const cache = new ServerDataCache();
  cache.put("HAWKER_CENTRES", parts.centres ?? [centre("H1", 1.3)], NOW);
  cache.put("CARPARKS", parts.carparks ?? [], NOW);
  if (parts.lots) cache.put("CARPARK_AVAILABILITY", parts.lots, parts.lotsAsOf ?? NOW);
  cache.put("FUEL_STATIONS", parts.fuel ?? [], NOW);
  cache.put("CHARGING_STATIONS", parts.chargers ?? [], NOW);
  if (parts.points) cache.put("CHARGER_AVAILABILITY", parts.points, NOW);
  return cache;
}
const first = (cache: ServerDataCache) => strategy.buildSites(cache, NOW)![0]!;

describe("RestStopSuggestionStrategy", () => {
  it("builds REST_STOP_SITES from hawker centres, carparks, fuel and chargers, and their availability", () => {
    expect(strategy.getDataset()).toBe("REST_STOP_SITES");
    expect(strategy.getInputs()).toEqual([
      "HAWKER_CENTRES",
      "CARPARKS",
      "CARPARK_AVAILABILITY",
      "FUEL_STATIONS",
      "CHARGING_STATIONS",
      "CHARGER_AVAILABILITY",
    ]);
  });

  it("can't build anything before the hawker centres are loaded", () => {
    expect(strategy.buildSites(new ServerDataCache(), NOW)).toBeUndefined();
  });

  it("scores half for food choice, half for parking: no carpark 0.5, unknown space 0.75, plenty of free lots 1", () => {
    expect(first(cacheWith({})).score).toBe(0.5);
    expect(first(cacheWith({ carparks: [carpark("C1", 1.3005)] })).score).toBe(0.75);
    expect(first(cacheWith({ carparks: [carpark("C1", 1.3005)], lots: [{ id: "C1", availableLots: 50 }] })).score).toBe(
      1,
    );
  });

  it("scales food choice by cooked-food stalls (60 is full choice) and parking by free lots (50 is plenty)", () => {
    expect(first(cacheWith({ centres: [centre("SMALL", 1.3, [], 30)] })).score).toBeCloseTo(0.25);
    expect(first(cacheWith({ centres: [centre("HUGE", 1.3, [], 226)] })).score).toBeCloseTo(0.5); // capped
    expect(
      first(cacheWith({ carparks: [carpark("C1", 1.3005)], lots: [{ id: "C1", availableLots: 10 }] })).score,
    ).toBeCloseTo(0.6);
  });

  it("separates centres the first formula tied: more choice ranks higher (real data had all 119 at 1.00)", () => {
    const cache = cacheWith({
      centres: [centre("SMALL", 1.32, [], 24), centre("BIG", 1.3, [], 87)],
      carparks: [carpark("C1", 1.3005), carpark("C2", 1.3205)],
      lots: [
        { id: "C1", availableLots: 400 },
        { id: "C2", availableLots: 400 },
      ],
    });
    expect(strategy.buildSites(cache, NOW)!.map((s) => [s.id, s.score])).toEqual([
      ["BIG", 1],
      ["SMALL", 0.7],
    ]);
  });

  it("counts a full carpark as no parking, unless another one nearby might have space", () => {
    expect(first(cacheWith({ carparks: [carpark("C1", 1.3005)], lots: [{ id: "C1", availableLots: 0 }] })).score).toBe(
      0.5,
    );
    const oneFullOneUnknown = cacheWith({
      carparks: [carpark("C1", 1.3005), carpark("C2", 1.3006)],
      lots: [{ id: "C1", availableLots: 0 }],
    });
    expect(first(oneFullOneUnknown).score).toBe(0.75);
  });

  it("only counts what is within 500 m", () => {
    expect(first(cacheWith({ carparks: [carpark("C1", 1.31)], lots: [{ id: "C1", availableLots: 99 }] })).score).toBe(
      0.5,
    ); // ~1.1 km
  });

  it("treats free lots over 15 minutes old as unknown (D22)", () => {
    const old = cacheWith({
      carparks: [carpark("C1", 1.3005)],
      lots: [{ id: "C1", availableLots: 12 }],
      lotsAsOf: new Date("2026-10-28T04:44:00Z"),
    });
    expect(first(old)).toMatchObject({ score: 0.75, hasParking: true });
    expect(first(old)).not.toHaveProperty("freeLots");
  });

  it("flags fuel and charging nearby without scoring them: the client matches them to the vehicle (FR-2.1.1)", () => {
    const s = first(
      cacheWith({
        fuel: [fuel(1.3004)],
        chargers: [charger("E1", 1.3003)],
        points: [{ id: "E1", availablePoints: 3 }],
      }),
    );
    expect(s).toMatchObject({ hasFuel: true, hasCharging: true, freeChargePoints: 3, score: 0.5 });
    expect(s.summary).toBe("Food (60 stalls) · fuel · EV charging (3 free)");
  });

  it("describes free parking in the summary", () => {
    const s = first(cacheWith({ carparks: [carpark("C1", 1.3005)], lots: [{ id: "C1", availableLots: 12 }] }));
    expect(s).toMatchObject({
      summary: "Food (60 stalls) · parking (12 free)",
      freeLots: 12,
      foodStalls: 60,
      radius: 500,
    });
  });

  it("leaves out a centre closed today, in Singapore's calendar (D13)", () => {
    const closed = centre("CLOSED", 1.3, [{ from: "2026-10-28", to: "2026-10-28", reason: "cleaning" }]);
    const sites = strategy.buildSites(cacheWith({ centres: [closed, centre("OPEN", 1.32)] }), NOW)!;
    expect(sites.map((s) => s.id)).toEqual(["OPEN"]);
  });

  it("counts days in Singapore time: at 1 am on 28 Oct there (still 27 Oct in UTC) a 28 Oct closure applies", () => {
    const closed = centre("CLOSED", 1.3, [{ from: "2026-10-28", to: "2026-10-28", reason: "cleaning" }]);
    const sites = strategy.buildSites(
      cacheWith({ centres: [closed, centre("OPEN", 1.32)] }),
      new Date("2026-10-27T17:00:00Z"),
    )!;
    expect(sites.map((s) => s.id)).toEqual(["OPEN"]);
  });

  it("leaves out wet markets with no cooked-food stalls: a rest stop needs food", () => {
    const sites = strategy.buildSites(
      cacheWith({ centres: [centre("MARKET", 1.3, [], 0), centre("FOOD", 1.32)] }),
      NOW,
    )!;
    expect(sites.map((s) => s.id)).toEqual(["FOOD"]);
  });

  it("lists the best sites first", () => {
    const cache = cacheWith({
      centres: [centre("A", 1.3), centre("B", 1.32)],
      carparks: [carpark("C1", 1.3205)],
      lots: [{ id: "C1", availableLots: 5 }],
    });
    expect(strategy.buildSites(cache, NOW)!.map((s) => s.id)).toEqual(["B", "A"]);
  });
});
