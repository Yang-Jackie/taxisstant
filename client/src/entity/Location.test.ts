// M1 acceptance tests — Location (design model «dataType» Location; decision D6: address optional, metres).
import { describe, expect, it } from "vitest";
import { Location } from "./Location";

/** Haversine results differ slightly between implementations; 1 m is plenty for a taxi map. */
function expectMetres(actual: number, expected: number) {
  expect(Math.abs(actual - expected)).toBeLessThan(1);
}

describe("Location", () => {
  it("stores latitude, longitude and an optional address", () => {
    const withAddress = new Location(1.284, 103.8514, "Raffles Place");
    expect(withAddress.latitude).toBe(1.284);
    expect(withAddress.longitude).toBe(103.8514);
    expect(withAddress.address).toBe("Raffles Place");

    const withoutAddress = new Location(1.3, 103.8);
    expect(withoutAddress.address).toBeUndefined();
  });

  it("is read-only once created", () => {
    const loc = new Location(1.3, 103.8);
    // Type-level check only (runs in `npm run typecheck`); the arrow is never called.
    const tryIt = () => {
      // @ts-expect-error — latitude is readonly
      loc.latitude = 2;
    };
    expect(typeof tryIt).toBe("function");
  });

  it("rejects coordinates that cannot exist", () => {
    expect(() => new Location(91, 0)).toThrow(RangeError);
    expect(() => new Location(-91, 0)).toThrow(RangeError);
    expect(() => new Location(0, 181)).toThrow(RangeError);
    expect(() => new Location(0, -181)).toThrow(RangeError);
    expect(() => new Location(Number.NaN, 0)).toThrow(RangeError);
  });

  it("accepts coordinates exactly on the limit", () => {
    expect(() => new Location(90, 180)).not.toThrow();
    expect(() => new Location(-90, -180)).not.toThrow();
  });

  describe("distanceTo (haversine, Earth radius 6 371 000 m, result in metres)", () => {
    it("is 0 for the same point", () => {
      const loc = new Location(1.3, 103.8);
      expect(loc.distanceTo(new Location(1.3, 103.8))).toBe(0);
    });

    it("is about 111 195 m for one degree of latitude", () => {
      expectMetres(new Location(0, 0).distanceTo(new Location(1, 0)), 111_194.93);
    });

    it("measures a real Singapore trip: Raffles Place to Changi T3 ≈ 17.28 km", () => {
      const rafflesPlace = new Location(1.284, 103.8514);
      const changiT3 = new Location(1.357, 103.9886);
      expectMetres(rafflesPlace.distanceTo(changiT3), 17_277.43);
    });

    it("gives the same answer in both directions", () => {
      const a = new Location(1.3, 103.8);
      const b = new Location(1.31, 103.85);
      expect(a.distanceTo(b)).toBeCloseTo(b.distanceTo(a), 6);
    });
  });
});
