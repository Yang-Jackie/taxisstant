// Marker icons in the style of the team's mockup: a white circle with the layer's icon, amber for finding passengers
// (FR-1.2) and green for rest and facilities (FR-1.1). Icons: Tabler Icons (MIT), the set the mockup uses.
import bolt from "@tabler/icons/outline/bolt.svg?raw";
import bowl from "@tabler/icons/outline/bowl.svg?raw";
import car from "@tabler/icons/outline/car.svg?raw";
import flame from "@tabler/icons/outline/flame.svg?raw";
import gasStation from "@tabler/icons/outline/gas-station.svg?raw";
import mapPin from "@tabler/icons/outline/map-pin.svg?raw";
import parking from "@tabler/icons/outline/parking.svg?raw";
import star from "@tabler/icons/outline/star.svg?raw";
import { DivIcon } from "leaflet";
import type { LayerType } from "../entity/LayerType";
import type { RecommendationKind } from "../entity/RecommendationKind";

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

const driverIcons = new Map<boolean, DivIcon>();

/** The mockup's driver dot: blue with a white ring and a soft halo; grey when the position isn't live. */
export function driverIcon(live: boolean): DivIcon {
  let icon = driverIcons.get(live);
  if (!icon) {
    icon = new DivIcon({
      className: `driver-dot${live ? "" : " driver-dot--stale"}`,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });
    driverIcons.set(live, icon);
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

/** Suggestions take the colour of their group: pickups amber, rest stops green (the data dictionary's toggles). */
export const SUGGESTION_GROUP: Record<RecommendationKind, "find" | "rest"> = { PICKUP: "find", REST_STOP: "rest" };

const PIN_WIDTH = 46;
const PIN_HEIGHT = 28;
const PIN_TAIL = 7;
const suggestionIcons = new Map<string, DivIcon>();

/**
 * The mockup's pin: a bubble with a star and the site's place in the ranking (D34). Its tail stops at the top of the
 * landmark's own marker, so both stay readable.
 */
export function suggestionIcon(k: RecommendationKind, place: number): DivIcon {
  const key = `${k}-${place}`;
  let icon = suggestionIcons.get(key);
  if (!icon) {
    icon = new DivIcon({
      className: `suggestion-pin suggestion-pin--${SUGGESTION_GROUP[k]}`,
      html: `<span class="suggestion-pin__bubble">${star}${place}</span>`,
      iconSize: [PIN_WIDTH, PIN_HEIGHT],
      iconAnchor: [PIN_WIDTH / 2, PIN_HEIGHT + PIN_TAIL + MARKER_PX / 2],
      popupAnchor: [0, -(PIN_HEIGHT + PIN_TAIL + MARKER_PX / 2)],
    });
    suggestionIcons.set(key, icon);
  }
  return icon;
}
