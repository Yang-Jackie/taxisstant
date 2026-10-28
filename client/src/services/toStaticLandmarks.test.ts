// Package 2b tests — the server's plain JSON → real entities, one converter per static layer (D6).
import { describe, expect, it } from "vitest";
import { Carpark } from "../entity/Carpark";
import { ChargingStation } from "../entity/ChargingStation";
import { FuelStation } from "../entity/FuelStation";
import { HawkerCentre } from "../entity/HawkerCentre";
import { CARPARKS, CHARGERS, FUEL, HAWKERS } from "../testing/fakeServer";
import { toCarpark } from "./toCarpark";
import { toChargingStation } from "./toChargingStation";
import { toFuelStation } from "./toFuelStation";
import { toHawkerCentre } from "./toHawkerCentre";

describe("converters for the static layers", () => {
  it("toCarpark makes a real Carpark", () => {
    const carpark = toCarpark(CARPARKS[0]!);
    expect(carpark).toBeInstanceOf(Carpark);
    expect(carpark).toMatchObject({ id: "1", name: "Suntec City", agency: "LTA", area: "Marina" });
    expect(carpark.location.latitude).toBe(1.29375);
  });

  it("toFuelStation makes a real FuelStation, with its address in its Location", () => {
    const station = toFuelStation(FUEL[0]!);
    expect(station).toBeInstanceOf(FuelStation);
    expect(station).toMatchObject({ brand: "Shell", openingHours: "24/7" });
    expect(station.location.address).toBe("772 Upper Bukit Timah Road, Singapore 678122");
  });

  it("toChargingStation makes a real ChargingStation", () => {
    const station = toChargingStation(CHARGERS[0]!);
    expect(station).toBeInstanceOf(ChargingStation);
    expect(station).toMatchObject({
      operators: ["SP MOBILITY PTE. LTD."],
      chargePoints: 3,
      maxPowerKw: 50,
      hasDcFast: true,
    });
    expect(station.location.address).toBe("3E RIVER VALLEY ROAD SINGAPORE 179024");
  });

  it("toHawkerCentre makes a real HawkerCentre whose isOpen works", () => {
    const centre = toHawkerCentre(HAWKERS[0]!);
    expect(centre).toBeInstanceOf(HawkerCentre);
    expect(centre.isOpen(new Date("2026-12-07T12:00:00+08:00"))).toBe(false);
    expect(centre.location.address).toBe("2, Adam Road, Singapore 289876");
  });

  it("refuses impossible coordinates (Location's own check)", () => {
    expect(() => toCarpark({ ...CARPARKS[0]!, latitude: 91 })).toThrow(RangeError);
  });
});
