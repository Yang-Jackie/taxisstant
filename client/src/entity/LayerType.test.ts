// M1 acceptance tests — LayerType (design model «enumeration» LayerType, as a string union per the AI report).
// The expectTypeOf / @ts-expect-error lines are checked by `npm run typecheck`, not at runtime.
import { describe, expect, expectTypeOf, it } from "vitest";
import { LAYER_TYPES, type LayerType } from "./LayerType";

describe("LayerType", () => {
  it("lists the seven map layers from the design model, in order", () => {
    expect(LAYER_TYPES).toEqual(["TAXI_STAND", "TAXIS", "HOTSPOT", "CARPARK", "FUEL", "CHARGING", "HAWKER"]);
  });

  it("is exactly the union of the values in LAYER_TYPES", () => {
    expectTypeOf<LayerType>().toEqualTypeOf<
      "TAXI_STAND" | "TAXIS" | "HOTSPOT" | "CARPARK" | "FUEL" | "CHARGING" | "HAWKER"
    >();
  });

  it("rejects strings that are not layers", () => {
    // @ts-expect-error — "BUS" is not a LayerType
    const bad: LayerType = "BUS";
    expect(LAYER_TYPES).not.toContain(bad);
  });
});
