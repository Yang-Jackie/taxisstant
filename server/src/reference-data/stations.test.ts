// Package 2c tests — the committed station file (D14): every MRT and LRT station's codes and position.
import { describe, expect, it } from "vitest";
import { metresBetween } from "../sync/geo.js";
import { loadStations } from "./stations.js";

const stations = loadStations();
const unique = [...new Set(stations.values())];

describe("train-stations.json", () => {
  it("covers every open station: about 185 of them, under about 220 codes", () => {
    expect(unique.length).toBeGreaterThan(180);
    expect(stations.size).toBeGreaterThan(210);
  });

  it("gives an interchange one entry under all its codes", () => {
    expect(stations.get("EW13")).toBe(stations.get("NS25"));
    expect(stations.get("EW13")?.name).toBe("City Hall");
    expect(stations.get("NS27")?.codes).toEqual(["CC33", "CE2", "NS27", "TE20"]); // Marina Bay, once per line in OneMap
  });

  it("knows the codes LTA's crowd API uses that OneMap doesn't (CE1, CE2, PTC)", () => {
    expect(stations.get("CE1")?.name).toBe("Bayfront");
    expect(stations.get("CE2")?.name).toBe("Marina Bay");
    expect(stations.get("PTC")?.name).toBe("Punggol");
  });

  it("puts each station where it is: City Hall within 200 m of its real position", () => {
    const cityHall = stations.get("EW13")!;
    expect(
      metresBetween({ lat: cityHall.latitude, lon: cityHall.longitude }, { lat: 1.2931, lon: 103.852 }),
    ).toBeLessThan(200);
  });

  it("has every station inside Singapore, each with its own id", () => {
    for (const s of unique) {
      expect(s.latitude, s.name).toBeGreaterThan(1.2);
      expect(s.latitude, s.name).toBeLessThan(1.48);
      expect(s.longitude, s.name).toBeGreaterThan(103.6);
      expect(s.longitude, s.name).toBeLessThan(104.05);
    }
    expect(new Set(unique.map((s) => s.id)).size).toBe(unique.length);
  });

  it("leaves out stations that aren't open yet (no exits in LTA's data)", () => {
    expect(stations.get("TE10")).toBeUndefined(); // Mount Pleasant
  });
});
