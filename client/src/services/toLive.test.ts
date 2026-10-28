// Package 2d tests — the server's live JSON → real entities (D6).
import { describe, expect, it } from "vitest";
import { Hotspot } from "../entity/Hotspot";
import { Taxi } from "../entity/Taxi";
import { hotspotsAt, TAXIS } from "../testing/fakeServer";
import { toHotspot } from "./toHotspot";
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
