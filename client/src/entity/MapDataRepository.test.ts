// M1 acceptance tests — MapDataRepository «container» (design model, 23 Oct): getByLayerType, replaceLayer.
// updateAvailability and the suggestion methods come in Phase 2, with Carpark, ChargingStation and SuggestedSite.
import { describe, expect, expectTypeOf, it } from "vitest";
import type { Locatable } from "./Locatable";
import { Location } from "./Location";
import { MapDataRepository } from "./MapDataRepository";
import { TaxiStand } from "./TaxiStand";

function stand(id: string, latitude: number, longitude: number): TaxiStand {
  return new TaxiStand({
    id,
    name: `Stand ${id}`,
    location: new Location(latitude, longitude),
    standType: "Stand",
    isBarrierFree: false,
  });
}

/** Anything with getLocation() is Locatable — a plain object works too (TypeScript checks shapes, not class names). */
function taxiAt(latitude: number, longitude: number): Locatable {
  const position = new Location(latitude, longitude);
  return { getLocation: () => position };
}

const a = stand("A", 1.301, 103.8);
const b = stand("B", 1.303, 103.8);
const c = stand("C", 1.31, 103.8);

describe("MapDataRepository", () => {
  it("returns an empty array for a layer that was never loaded", () => {
    expect(new MapDataRepository().getByLayerType("TAXI_STAND")).toEqual([]);
  });

  it("returns what was put in with replaceLayer", () => {
    const repo = new MapDataRepository();
    repo.replaceLayer("TAXI_STAND", [a, c]);
    expect(repo.getByLayerType("TAXI_STAND")).toEqual([a, c]);
  });

  it("replaces the whole layer instead of appending", () => {
    const repo = new MapDataRepository();
    repo.replaceLayer("TAXI_STAND", [a, b]);
    repo.replaceLayer("TAXI_STAND", [c]);
    expect(repo.getByLayerType("TAXI_STAND")).toEqual([c]);
  });

  it("keeps layers separate", () => {
    const repo = new MapDataRepository();
    const taxi = taxiAt(1.3, 103.8);
    repo.replaceLayer("TAXI_STAND", [a]);
    repo.replaceLayer("TAXIS", [taxi]);
    expect(repo.getByLayerType("TAXI_STAND")).toEqual([a]);
    expect(repo.getByLayerType("TAXIS")).toEqual([taxi]);
  });

  it("holds anything Locatable, not only Landmarks", () => {
    const repo = new MapDataRepository();
    const taxis = [taxiAt(1.3, 103.8), taxiAt(1.31, 103.81)];
    repo.replaceLayer("TAXIS", taxis);
    expect(repo.getByLayerType("TAXIS").map((t) => t.getLocation().latitude)).toEqual([1.3, 1.31]);
  });

  it("can't be changed from outside through the arrays it receives or returns", () => {
    const repo = new MapDataRepository();
    const input = [a];
    repo.replaceLayer("TAXI_STAND", input);

    input.push(c); // changing the array you passed in…
    repo.getByLayerType("TAXI_STAND").push(b); // …or the array you got back…

    expect(repo.getByLayerType("TAXI_STAND")).toEqual([a]); // …doesn't change the repository
  });

  describe("typed layers (the key decides the item type)", () => {
    it("returns TaxiStand[] for TAXI_STAND, so stand fields need no checks", () => {
      const repo = new MapDataRepository();
      repo.replaceLayer("TAXI_STAND", [a]);
      const stands = repo.getByLayerType("TAXI_STAND");
      expectTypeOf(stands).toEqualTypeOf<TaxiStand[]>();
      expect(stands.map((s) => s.name)).toEqual(["Stand A"]);
    });

    it("refuses items of the wrong type for a layer", () => {
      const repo = new MapDataRepository();
      // Type-level check only (runs in `npm run typecheck`); the arrow is never called.
      const tryIt = () => {
        // @ts-expect-error — a bare Locatable is not a TaxiStand
        repo.replaceLayer("TAXI_STAND", [taxiAt(1.3, 103.8)]);
      };
      expect(typeof tryIt).toBe("function");
    });
  });
});
