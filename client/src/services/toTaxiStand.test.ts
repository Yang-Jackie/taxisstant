// M5 acceptance tests — toTaxiStand: turns the plain JSON the server sends (a TaxiStandDto) into a
// real TaxiStand object, with its methods. JSON can't carry methods, so this step is required (D6).
import type { TaxiStandDto } from "@taxisstant/shared";
import { describe, expect, it } from "vitest";
import { Landmark } from "../entity/Landmark";
import { TaxiStand } from "../entity/TaxiStand";
import { toTaxiStand } from "./toTaxiStand";

const dto: TaxiStandDto = {
  id: "A01",
  name: "Orchard Rd along driveway of Lucky Plaza",
  latitude: 1.304294727,
  longitude: 103.8338467,
  standType: "Stand",
  isBarrierFree: true,
};

describe("toTaxiStand", () => {
  it("makes a real TaxiStand, not a plain object", () => {
    const stand = toTaxiStand(dto);
    expect(stand).toBeInstanceOf(TaxiStand);
    expect(stand).toBeInstanceOf(Landmark);
    expect(stand.getType()).toBe("TAXI_STAND"); // a method — plain JSON wouldn't have it
  });

  it("copies every field across", () => {
    const stand = toTaxiStand(dto);
    expect(stand.id).toBe("A01");
    expect(stand.name).toBe("Orchard Rd along driveway of Lucky Plaza");
    expect(stand.standType).toBe("Stand");
    expect(stand.isBarrierFree).toBe(true);
  });

  it("builds a working Location from latitude and longitude", () => {
    const location = toTaxiStand(dto).getLocation();
    expect(location.latitude).toBe(1.304294727);
    expect(location.longitude).toBe(103.8338467);
    expect(location.distanceTo(location)).toBe(0);
  });

  it("refuses impossible coordinates (Location's own check)", () => {
    expect(() => toTaxiStand({ ...dto, latitude: 200 })).toThrow(RangeError);
  });
});
