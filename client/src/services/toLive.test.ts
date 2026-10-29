// Package 2d tests — the server's live JSON → real entities (D6). Package 7: the suggested sites.
import { describe, expect, it } from "vitest";
import { Hotspot } from "../entity/Hotspot";
import { SuggestedPickup } from "../entity/SuggestedPickup";
import { SuggestedRestStop } from "../entity/SuggestedRestStop";
import { Taxi } from "../entity/Taxi";
import { hotspotsAt, PICKUPS, REST_STOPS, TAXIS } from "../testing/fakeServer";
import { toHotspot } from "./toHotspot";
import { toSuggestedPickup } from "./toSuggestedPickup";
import { toSuggestedRestStop } from "./toSuggestedRestStop";
import { toTaxi } from "./toTaxi";

describe("toTaxi", () => {
  it("makes a real Taxi, seen when the server's snapshot was taken", () => {
    const seenAt = new Date("2026-10-28T13:00:00Z");
    const taxi = toTaxi(TAXIS[0]!, seenAt);
    expect(taxi).toBeInstanceOf(Taxi);
    expect([taxi.position.latitude, taxi.position.longitude, taxi.seenAt]).toEqual([1.3045, 103.8335, seenAt]);
  });
});

describe("toHotspot", () => {
  const now = new Date("2026-10-28T13:00:00Z");
  const [high, medium, low] = hotspotsAt(now);

  it("makes a real Hotspot for a busy station, with its slot as Dates", () => {
    const hotspot = toHotspot(high!)!;
    expect(hotspot).toBeInstanceOf(Hotspot);
    expect(hotspot).toMatchObject({
      id: "city-hall",
      stationName: "City Hall",
      density: "HIGH",
      codes: ["EW13", "NS25"],
    });
    expect(hotspot.validTo.toISOString()).toBe(high!.validTo);
    expect(toHotspot(medium!)?.density).toBe("MEDIUM");
  });

  it("makes nothing for a quiet station: LOW isn't a hotspot (D23)", () => {
    expect(toHotspot(low!)).toBeUndefined();
  });
});

describe("toSuggestedPickup and toSuggestedRestStop", () => {
  const asOf = new Date("2026-10-29T13:00:00Z");

  it("make a real SuggestedPickup, scored when the server's list was built", () => {
    const site = toSuggestedPickup(PICKUPS[1]!, asOf);
    expect(site).toBeInstanceOf(SuggestedPickup);
    expect(site).toMatchObject({
      id: "A05",
      name: "Mt Elizabeth Rd at Mt Elizabeth Hospital",
      radius: 300,
      score: 0.5,
      summary: "Orchard crowded · 1 empty taxi nearby",
      asOf,
      taxiCount: 1,
      crowdDensity: "MEDIUM",
      stationName: "Orchard",
    });
    expect([site.centre.latitude, site.centre.longitude]).toEqual([1.304571786, 103.835547]);
  });

  it("make a real SuggestedRestStop, with what is near it", () => {
    const [adam, maxwell] = REST_STOPS.map((dto) => toSuggestedRestStop(dto, asOf));
    expect(adam).toBeInstanceOf(SuggestedRestStop);
    expect(adam).toMatchObject({
      id: "adam-road-food-centre",
      radius: 500,
      score: 0.8,
      asOf,
      foodStalls: 32,
      hasParking: true,
      freeLots: 40,
      hasFuel: true,
      hasCharging: false,
    });
    expect(adam!.freeChargePoints).toBeUndefined();
    expect(maxwell).toMatchObject({ hasCharging: true, freeChargePoints: 2, hasFuel: false });
    expect(maxwell!.freeLots).toBeUndefined();
  });
});
