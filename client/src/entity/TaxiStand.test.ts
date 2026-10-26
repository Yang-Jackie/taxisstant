// M1 acceptance tests — Landmark (abstract «entity», implements Locatable) and TaxiStand.
import { describe, expect, it } from "vitest";
import { Landmark } from "./Landmark";
import type { Locatable } from "./Locatable";
import { Location } from "./Location";
import { TaxiStand } from "./TaxiStand";

const location = new Location(1.2931, 103.8558, "Raffles City");

function makeStand() {
  return new TaxiStand({
    id: "A01",
    name: "Raffles City Taxi Stand",
    location,
    standType: "Stand",
    isBarrierFree: true,
  });
}

describe("TaxiStand", () => {
  it("is a Landmark", () => {
    expect(makeStand()).toBeInstanceOf(Landmark);
  });

  it("keeps the Landmark fields and its own fields", () => {
    const stand = makeStand();
    expect(stand.id).toBe("A01");
    expect(stand.name).toBe("Raffles City Taxi Stand");
    expect(stand.location).toBe(location);
    expect(stand.standType).toBe("Stand");
    expect(stand.isBarrierFree).toBe(true);
  });

  it("reports its layer as TAXI_STAND", () => {
    expect(makeStand().getType()).toBe("TAXI_STAND");
  });

  it("is Locatable: getLocation() returns its location", () => {
    const asLocatable: Locatable = makeStand(); // type-level: must compile
    expect(asLocatable.getLocation()).toBe(location);
  });

  it("is read-only once created", () => {
    const stand = makeStand();
    // Type-level check only (runs in `npm run typecheck`); the arrow is never called.
    const tryIt = () => {
      // @ts-expect-error — name is readonly
      stand.name = "Renamed";
      // @ts-expect-error — isBarrierFree is readonly
      stand.isBarrierFree = false;
    };
    expect(typeof tryIt).toBe("function");
  });
});

describe("Landmark", () => {
  it("is abstract: you can only create its subclasses", () => {
    // Type-level check only (runs in `npm run typecheck`); the arrow is never called.
    // @ts-expect-error — cannot create an instance of an abstract class
    const tryIt = () => new Landmark({ id: "x", name: "x", location });
    expect(typeof tryIt).toBe("function");
  });
});
