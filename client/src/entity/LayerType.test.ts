// M1 acceptance tests — LayerType (design model «enumeration» LayerType, as a string union per the AI report).
// The expectTypeOf / @ts-expect-error lines are checked by `npm run typecheck`, not at runtime.
import { describe, expect, expectTypeOf, it } from "vitest";
import { isLayerType, LAYER_TYPES, type LayerType } from "./LayerType";

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

// M6 — isLayerType: a type guard for values whose type we can't know in advance (e.g. read from storage).
describe("isLayerType", () => {
  it("accepts every real layer name", () => {
    for (const t of LAYER_TYPES) expect(isLayerType(t)).toBe(true);
  });

  it("rejects anything else, and narrows the type when it accepts", () => {
    const values: unknown[] = ["BUS", "taxi_stand", 42, null, undefined, { TAXI_STAND: true }];
    for (const v of values) expect(isLayerType(v)).toBe(false);

    const fromStorage: unknown = "FUEL";
    if (isLayerType(fromStorage)) {
      expectTypeOf(fromStorage).toEqualTypeOf<LayerType>(); // inside the if, TypeScript knows it's a LayerType
    }
  });
});
