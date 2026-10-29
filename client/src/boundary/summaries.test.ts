// Package 9b tests — a suggested site's summary, built on the phone from its facts so it can be in either language.
// In English it reads as the server's own summary (D28, D29).
import { describe, expect, it } from "vitest";
import { Location } from "../entity/Location";
import { SuggestedPickup, type SuggestedPickupProps } from "../entity/SuggestedPickup";
import { SuggestedRestStop, type SuggestedRestStopProps } from "../entity/SuggestedRestStop";
import { i18next } from "./i18n";
import { summaryOf } from "./summaries";

const en = i18next.getFixedT("en");
const zh = i18next.getFixedT("zh");
const base = {
  id: "x",
  name: "x",
  centre: new Location(1.3, 103.8),
  radius: 300,
  score: 0.5,
  summary: "",
  asOf: new Date(),
};
const pickup = (facts: Partial<SuggestedPickupProps>) => new SuggestedPickup({ ...base, taxiCount: 0, ...facts });
const restStop = (facts: Partial<SuggestedRestStopProps>) =>
  new SuggestedRestStop({ ...base, foodStalls: 60, hasParking: false, hasFuel: false, hasCharging: false, ...facts });

describe("summaryOf — pickups", () => {
  it("names the busiest station near and how busy, then the empty taxis competing", () => {
    const site = pickup({ stationName: "City Hall", crowdDensity: "HIGH", taxiCount: 3 });
    expect(summaryOf(site, en)).toBe("City Hall very crowded · 3 empty taxis nearby");
    expect(summaryOf(site, zh)).toBe("City Hall 非常拥挤 · 附近有 3 辆空德士");
  });

  it("says when no station is near and no taxi competes, and counts one taxi as one", () => {
    expect(summaryOf(pickup({}), en)).toBe("No station nearby · no empty taxis nearby");
    expect(summaryOf(pickup({ stationName: "Orchard", crowdDensity: "LOW", taxiCount: 1 }), en)).toBe(
      "Orchard quiet · 1 empty taxi nearby",
    );
  });
});

describe("summaryOf — rest stops", () => {
  it("gives the food, then whatever else is near: fuel, and chargers with how many are free", () => {
    const site = restStop({ hasFuel: true, hasCharging: true, freeChargePoints: 3 });
    expect(summaryOf(site, en)).toBe("Food (60 stalls) · fuel · EV charging (3 free)");
    expect(summaryOf(site, zh)).toBe("美食（60 个摊位） · 加油 · 电动车充电（3 个空闲）");
  });

  it("gives parking with its free lots when known, or just parking when not", () => {
    expect(summaryOf(restStop({ hasParking: true, freeLots: 12 }), en)).toBe("Food (60 stalls) · parking (12 free)");
    expect(summaryOf(restStop({ hasParking: true, hasCharging: true }), en)).toBe(
      "Food (60 stalls) · parking · EV charging",
    );
  });
});
