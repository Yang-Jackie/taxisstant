// Package 2b tests — the other static Landmarks of the design model: Carpark, FuelStation, ChargingStation.
import { describe, expect, it } from "vitest";
import { Carpark } from "./Carpark";
import { ChargingStation } from "./ChargingStation";
import { FuelStation } from "./FuelStation";
import { Landmark } from "./Landmark";
import { Location } from "./Location";

const here = new Location(1.3, 103.8);

describe("Carpark", () => {
  const carpark = new Carpark({ id: "1", name: "Suntec City", location: here, agency: "LTA", area: "Marina" });
  it("is a Landmark on the CARPARK layer", () => {
    expect(carpark).toBeInstanceOf(Landmark);
    expect(carpark.getType()).toBe("CARPARK");
  });
  it("knows who runs it", () => expect([carpark.agency, carpark.area]).toEqual(["LTA", "Marina"]));
});

describe("FuelStation", () => {
  it("is a Landmark on the FUEL layer, whose brand may be unknown (D12)", () => {
    const station = new FuelStation({ id: "node/1", name: "Fuel station", location: here });
    expect(station).toBeInstanceOf(Landmark);
    expect(station.getType()).toBe("FUEL");
    expect(station.brand).toBeUndefined();
  });
});

describe("ChargingStation", () => {
  const operators = ["CHARGE+ PTE. LTD.", "SP MOBILITY PTE. LTD."];
  const station = new ChargingStation({
    id: "x",
    name: "ONE HOLLAND VILLAGE",
    location: here,
    operators,
    chargePoints: 12,
    maxPowerKw: 120,
    hasDcFast: true,
    plugTypes: ["Combo 2", "Type 2"],
  });

  it("is a Landmark on the CHARGING layer, with several operators (D15)", () => {
    expect(station).toBeInstanceOf(Landmark);
    expect(station.getType()).toBe("CHARGING");
    expect(station.operators).toEqual(operators);
  });

  it("keeps its own copy of the lists it was given", () => {
    operators.push("SOMEONE ELSE");
    expect(station.operators).toHaveLength(2);
  });
});

// Package 2d — live availability on carparks and charging stations (the design model's availableLots, availablePoints).
describe("availability", () => {
  const asOf = new Date("2026-10-28T13:00:00Z");
  const carpark = new Carpark({ id: "1", name: "Suntec City", location: here, agency: "LTA" });

  it("withAvailability gives an updated copy and leaves the original alone", () => {
    const updated = carpark.withAvailability(117, asOf);
    expect(updated).not.toBe(carpark);
    expect(updated).toBeInstanceOf(Carpark);
    expect([updated.availableLots, updated.availabilityAsOf]).toEqual([117, asOf]);
    expect(carpark.availableLots).toBeUndefined();
    expect(updated.location).toBe(carpark.location); // same Location: the map doesn't move its marker
  });

  it("free lots count for 15 minutes after they were reported (D22), then they're unknown", () => {
    const updated = carpark.withAvailability(117, asOf);
    expect(updated.availableLotsAt(new Date("2026-10-28T13:15:00Z"))).toBe(117);
    expect(updated.availableLotsAt(new Date("2026-10-28T13:15:01Z"))).toBeUndefined();
    expect(carpark.availableLotsAt(asOf)).toBeUndefined(); // never reported
  });

  it("works the same for free chargers", () => {
    const station = new ChargingStation({
      id: "x",
      name: "X",
      location: here,
      operators: ["A"],
      chargePoints: 5,
      hasDcFast: false,
      plugTypes: ["Type 2"],
    });
    const updated = station.withAvailability(2, asOf);
    expect(updated).toBeInstanceOf(ChargingStation);
    expect(updated.availablePointsAt(new Date("2026-10-28T13:10:00Z"))).toBe(2);
    expect(updated.chargePoints).toBe(5);
    expect(updated.availablePointsAt(new Date("2026-10-28T14:00:00Z"))).toBeUndefined();
  });
});
