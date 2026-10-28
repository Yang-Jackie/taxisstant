// Marker icons in the style of the team's mockup: a white circle with the layer's icon, amber for finding passengers
// (FR-1.2) and green for rest and facilities (FR-1.1). Icons: Tabler Icons (MIT), the set the mockup uses.
import bolt from "@tabler/icons/outline/bolt.svg?raw";
import bowl from "@tabler/icons/outline/bowl.svg?raw";
import car from "@tabler/icons/outline/car.svg?raw";
import flame from "@tabler/icons/outline/flame.svg?raw";
import gasStation from "@tabler/icons/outline/gas-station.svg?raw";
import mapPin from "@tabler/icons/outline/map-pin.svg?raw";
import parking from "@tabler/icons/outline/parking.svg?raw";
import { DivIcon } from "leaflet";
import type { LayerType } from "../entity/LayerType";

const SVG: Record<LayerType, string> = {
  TAXI_STAND: mapPin,
  TAXIS: car,
  HOTSPOT: flame,
  CARPARK: parking,
  FUEL: gasStation,
  CHARGING: bolt,
  HAWKER: bowl,
};

/** The mockup's two colour groups. */
export const GROUP: Record<LayerType, "find" | "rest"> = {
  TAXI_STAND: "find",
  TAXIS: "find",
  HOTSPOT: "find",
  CARPARK: "rest",
  FUEL: "rest",
  CHARGING: "rest",
  HAWKER: "rest",
};

const MARKER_PX = 38;
const icons = new Map<LayerType, DivIcon>();

/** One shared icon per layer: Leaflet can reuse it for every marker. */
export function markerIcon(t: LayerType): DivIcon {
  let icon = icons.get(t);
  if (!icon) {
    icon = new DivIcon({
      className: `marker-chip marker-chip--${GROUP[t]}`,
      html: SVG[t],
      iconSize: [MARKER_PX, MARKER_PX],
      iconAnchor: [MARKER_PX / 2, MARKER_PX / 2],
      popupAnchor: [0, -MARKER_PX / 2],
    });
    icons.set(t, icon);
  }
  return icon;
}

/** A bubble with the layer's icon and a count, bigger for bigger groups (D17). Layers in one colour group stay apart. */
export function clusterIcon(t: LayerType, count: number): DivIcon {
  const px = count < 10 ? 42 : count < 100 ? 48 : 56;
  return new DivIcon({
    className: `marker-cluster marker-cluster--${GROUP[t]}`,
    html: `${SVG[t]}<span>${count}</span>`,
    iconSize: [px, px],
    iconAnchor: [px / 2, px / 2],
  });
}
