export const LAYER_TYPES = ["TAXI_STAND", "TAXIS", "HOTSPOT", "CARPARK", "FUEL", "CHARGING", "HAWKER"] as const;
export type LayerType = (typeof LAYER_TYPES)[number];

/** True if `value` is one of the seven layer names. Narrows `unknown` to `LayerType`. */
export function isLayerType(value: unknown): value is LayerType {
  return (LAYER_TYPES as readonly unknown[]).includes(value);
}
