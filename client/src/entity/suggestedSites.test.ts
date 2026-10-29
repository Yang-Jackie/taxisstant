// Package 7 tests — the suggested sites (design model: Site → SuggestedSite → SuggestedPickup, SuggestedRestStop).
import { describe, expect, it } from "vitest";
import { Location } from "./Location";
import { isRecommendationKind, RECOMMENDATION_KINDS } from "./RecommendationKind";
import { Site } from "./Site";
import { SuggestedPickup } from "./SuggestedPickup";
import { SuggestedRestStop } from "./SuggestedRestStop";
import { SuggestedSite } from "./SuggestedSite";

const asOf = new Date("2026-10-29T13:00:00Z");
const at = (minutes: number) => new Date(asOf.getTime() + minutes * 60 * 1000);

const pickup = new SuggestedPickup({
  id: "A01",
  name: "Lucky Plaza",
  centre: new Location(1.3043, 103.8338),
  radius: 300,
  score: 0.6,
  summary: "Orchard crowded · no empty taxis nearby",
  asOf,
  taxiCount: 0,
  crowdDensity: "MEDIUM",
  stationName: "Orchard",
});
const restStop = new SuggestedRestStop({
  id: "maxwell",
  name: "Maxwell Food Centre",
  centre: new Location(1.28048, 103.84458),
  radius: 500,
  score: 0.7,
  summary: "Food (100 stalls)",
  asOf,
  foodStalls: 100,
  hasParking: true,
  hasFuel: false,
  hasCharging: true,
  freeChargePoints: 2,
});

describe("RecommendationKind", () => {
  it("is the design model's PICKUP and REST_STOP", () => {
    expect(RECOMMENDATION_KINDS).toEqual(["PICKUP", "REST_STOP"]);
    expect(isRecommendationKind("REST_STOP")).toBe(true);
    expect(isRecommendationKind("TAXIS")).toBe(false);
    expect(isRecommendationKind(undefined)).toBe(false);
  });
});

describe("SuggestedPickup and SuggestedRestStop", () => {
  it("are Sites with a score, a summary and when they were scored", () => {
    for (const s of [pickup, restStop]) {
      expect(s).toBeInstanceOf(SuggestedSite);
      expect(s).toBeInstanceOf(Site);
      expect(s.getLocation()).toBe(s.centre);
      expect(s.asOf).toBe(asOf);
    }
    expect(pickup.contains(new Location(1.3043, 103.836))).toBe(true); // 245 m away, inside its 300 m
    expect(restStop.contains(new Location(1.28048, 103.8501))).toBe(false); // 614 m
  });

  it("say which suggestion they belong to", () => {
    expect(pickup.getKind()).toBe("PICKUP");
    expect(restStop.getKind()).toBe("REST_STOP");
  });

  it("keep their own facts", () => {
    expect(pickup).toMatchObject({ taxiCount: 0, crowdDensity: "MEDIUM", stationName: "Orchard" });
    expect(restStop).toMatchObject({ foodStalls: 100, hasParking: true, hasFuel: false, freeChargePoints: 2 });
    expect(restStop.freeLots).toBeUndefined();
  });

  it("a pickup is fresh for 5 minutes, like the taxis it was scored from (D36)", () => {
    expect(pickup.isFresh(at(5))).toBe(true);
    expect(pickup.isFresh(at(5.01))).toBe(false);
    expect(pickup.freshUntil()).toEqual(at(5));
  });

  it("a rest stop is fresh for 15 minutes, like the free lots it was scored from (D36)", () => {
    expect(restStop.isFresh(at(15))).toBe(true);
    expect(restStop.isFresh(at(15.01))).toBe(false);
    expect(restStop.freshUntil()).toEqual(at(15));
  });
});
