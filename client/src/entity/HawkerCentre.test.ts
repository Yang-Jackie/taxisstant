// Package 2b tests — HawkerCentre «entity»: a Landmark whose isOpen(t) checks NEA's closures (D13).
import { describe, expect, it } from "vitest";
import { HawkerCentre, singaporeDate } from "./HawkerCentre";
import { Landmark } from "./Landmark";
import { Location } from "./Location";

const centre = new HawkerCentre({
  id: "adam-road-food-centre",
  name: "Adam Road Food Centre",
  location: new Location(1.324131966, 103.8141632, "2, Adam Road, Singapore 289876"),
  foodStalls: 32,
  marketStalls: 0,
  closures: [
    { from: "2026-12-07", to: "2026-12-08", reason: "cleaning" },
    { from: "2026-03-30", to: "2026-03-31", reason: "cleaning" },
  ],
});

describe("HawkerCentre", () => {
  it("is a Landmark on the HAWKER layer", () => {
    expect(centre).toBeInstanceOf(Landmark);
    expect(centre.getType()).toBe("HAWKER");
  });

  it("keeps its closures in date order", () => {
    expect(centre.closures.map((c) => c.from)).toEqual(["2026-03-30", "2026-12-07"]);
  });

  it("is closed on every day of a closure, first and last included", () => {
    expect(centre.isOpen(new Date("2026-03-29T12:00:00+08:00"))).toBe(true);
    expect(centre.isOpen(new Date("2026-03-30T00:00:00+08:00"))).toBe(false);
    expect(centre.isOpen(new Date("2026-03-31T23:59:00+08:00"))).toBe(false);
    expect(centre.isOpen(new Date("2026-04-01T00:00:00+08:00"))).toBe(true);
  });

  it("counts days in Singapore time, whatever time zone the phone is in", () => {
    // 01:00 on 30 Mar in Singapore is still 29 Mar in UTC
    expect(centre.isOpen(new Date("2026-03-29T17:00:00Z"))).toBe(false);
    expect(singaporeDate(new Date("2026-03-29T17:00:00Z"))).toBe("2026-03-30");
  });

  it("says which closure applies today, and which comes next", () => {
    expect(centre.closureOn(new Date("2026-12-08T09:00:00+08:00"))?.from).toBe("2026-12-07");
    expect(centre.nextClosure(new Date("2026-10-28T09:00:00+08:00"))?.from).toBe("2026-12-07");
    expect(centre.nextClosure(new Date("2026-12-25T09:00:00+08:00"))).toBeUndefined();
  });

  it("is always open when NEA lists no closures", () => {
    const noClosures = new HawkerCentre({
      id: "x",
      name: "X",
      location: new Location(1.3, 103.8),
      foodStalls: 1,
      marketStalls: 0,
      closures: [],
    });
    expect(noClosures.isOpen(new Date())).toBe(true);
  });
});
