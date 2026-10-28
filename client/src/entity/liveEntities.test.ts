// Package 2d tests — the live entities of the design model (Taxi, Site → Hotspot) and how old their data may be (D22).
import { describe, expect, it } from "vitest";
import { AVAILABILITY_MAX_AGE_MS, HOTSPOT_MAX_LAG_MS, isRecent, TAXI_MAX_AGE_MS } from "./freshness";
import { Hotspot, HOTSPOT_RADIUS_M } from "./Hotspot";
import { Location } from "./Location";
import { Site } from "./Site";
import { Taxi } from "./Taxi";

const MIN = 60 * 1000;
const at = (iso: string) => new Date(iso);

describe("freshness limits (D22)", () => {
  it("are 5 minutes for taxis, 15 for availability, 30 after a hotspot's slot", () => {
    expect([TAXI_MAX_AGE_MS, AVAILABILITY_MAX_AGE_MS, HOTSPOT_MAX_LAG_MS]).toEqual([5 * MIN, 15 * MIN, 30 * MIN]);
  });

  it("isRecent includes the limit itself", () => {
    const seen = at("2026-10-28T13:00:00Z");
    expect(isRecent(seen, new Date(seen.getTime() + 5 * MIN), 5 * MIN)).toBe(true);
    expect(isRecent(seen, new Date(seen.getTime() + 5 * MIN + 1), 5 * MIN)).toBe(false);
  });
});

describe("Taxi", () => {
  const taxi = new Taxi(new Location(1.3045, 103.8335), at("2026-10-28T13:00:00Z"));

  it("is Locatable at its position", () => {
    expect(taxi.getLocation()).toBe(taxi.position);
  });

  it("is fresh for 5 minutes after its snapshot (UC 0002), then not", () => {
    expect(taxi.isFresh(at("2026-10-28T13:05:00Z"))).toBe(true);
    expect(taxi.isFresh(at("2026-10-28T13:05:01Z"))).toBe(false);
  });
});

describe("Hotspot", () => {
  const slot = { validFrom: at("2026-10-28T12:40:00Z"), validTo: at("2026-10-28T12:50:00Z") };
  const cityHall = new Hotspot({
    id: "city-hall",
    centre: new Location(1.2931, 103.852),
    stationName: "City Hall",
    codes: ["EW13", "NS25"],
    density: "HIGH",
    ...slot,
  });
  const dhoby = new Hotspot({
    id: "dhoby-ghaut",
    centre: new Location(1.2989, 103.8457),
    stationName: "Dhoby Ghaut",
    codes: ["NS24"],
    density: "MEDIUM",
    ...slot,
  });

  it("is a Site: an area around its station, bigger when busier (D23)", () => {
    expect(cityHall).toBeInstanceOf(Site);
    expect(cityHall.getLocation()).toBe(cityHall.centre);
    expect([cityHall.radius, dhoby.radius]).toEqual([HOTSPOT_RADIUS_M.HIGH, HOTSPOT_RADIUS_M.MEDIUM]);
    expect(cityHall.radius).toBeGreaterThan(dhoby.radius);
  });

  it("contains places within its radius (the design model's Site.contains)", () => {
    expect(cityHall.contains(new Location(1.2931, 103.8545))).toBe(true); // about 280 m east
    expect(cityHall.contains(new Location(1.2931, 103.8575))).toBe(false); // about 610 m east
  });

  it("is current until 30 minutes after its slot ends (LTA publishes slots late, D20)", () => {
    expect(cityHall.isCurrent(at("2026-10-28T13:20:00Z"))).toBe(true);
    expect(cityHall.isCurrent(at("2026-10-28T13:20:01Z"))).toBe(false);
  });
});
