export const LAYER_TYPES = ["TAXI_STAND", "TAXIS", "HOTSPOT", "CARPARK", "FUEL", "CHARGING", "HAWKER"] as const;
export type LayerType = (typeof LAYER_TYPES)[number];

/** True if `value` is one of the seven layer names. Narrows `unknown` to `LayerType`. */
export function isLayerType(value: unknown): value is LayerType {
  return (LAYER_TYPES as readonly unknown[]).includes(value);
}

/** Layers whose data changes rarely: downloaded at startup, re-checked daily, kept for offline use (D1, D18). */
export const STATIC_LAYERS = [
  "TAXI_STAND",
  "CARPARK",
  "FUEL",
  "CHARGING",
  "HAWKER",
] as const satisfies readonly LayerType[];
export type StaticLayer = (typeof STATIC_LAYERS)[number];

export function isStaticLayer(t: LayerType): t is StaticLayer {
  return (STATIC_LAYERS as readonly LayerType[]).includes(t);
}
