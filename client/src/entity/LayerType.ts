export const LAYER_TYPES = ["TAXI_STAND", "TAXIS", "HOTSPOT", "CARPARK", "FUEL", "CHARGING", "HAWKER"] as const;
export type LayerType = (typeof LAYER_TYPES)[number];