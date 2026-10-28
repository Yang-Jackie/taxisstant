// Package 2a tests — metresBetween: the distance used to spot a station mapped twice.
import { describe, expect, it } from "vitest";
import { metresBetween } from "./geo.js";

describe("metresBetween", () => {
  it("is zero for the same point", () => {
    expect(metresBetween({ lat: 1.3, lon: 103.8 }, { lat: 1.3, lon: 103.8 })).toBe(0);
  });

  it("is within 1% of the real distance: Raffles Place MRT to Lucky Plaza is about 3.0 km", () => {
    const d = metresBetween({ lat: 1.284, lon: 103.8515 }, { lat: 1.3043, lon: 103.8338 });
    expect(d).toBeGreaterThan(2_975);
    expect(d).toBeLessThan(3_025);
  });

  it("is symmetric", () => {
    const a = { lat: 1.29, lon: 103.85 };
    const b = { lat: 1.35, lon: 103.94 };
    expect(metresBetween(a, b)).toBeCloseTo(metresBetween(b, a), 6);
  });
});
