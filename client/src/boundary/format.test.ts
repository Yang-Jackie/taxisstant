// Package 7 tests — how times and distances read on screen.
import { describe, expect, it } from "vitest";
import { clock, distance } from "./format";

describe("distance", () => {
  it("says metres to the nearest 10 below a kilometre", () => {
    expect([distance(4), distance(196), distance(994)]).toEqual(["0 m", "200 m", "990 m"]);
  });

  it("says kilometres with one decimal from a kilometre on", () => {
    expect([distance(996), distance(1240), distance(2907)]).toEqual(["1.0 km", "1.2 km", "2.9 km"]);
  });
});

describe("clock", () => {
  it("tells Singapore time, whatever the phone's time zone (tests run in Los Angeles)", () => {
    expect(clock.format(new Date("2026-10-29T13:05:00Z"))).toBe("21:05");
  });
});
