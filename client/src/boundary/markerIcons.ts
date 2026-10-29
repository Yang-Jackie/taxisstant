// Marker icons in the style of the team's mockup: a white circle with the layer's icon, amber for finding passengers
// (FR-1.2) and green for rest and facilities (FR-1.1). Icons: Tabler Icons (MIT), the set the mockup uses, and a taxi
// stand drawn in their style (D52).
import starFilled from "@tabler/icons/filled/star.svg?raw";
import bolt from "@tabler/icons/outline/bolt.svg?raw";
import bowl from "@tabler/icons/outline/bowl.svg?raw";
import car from "@tabler/icons/outline/car.svg?raw";
import cup from "@tabler/icons/outline/cup.svg?raw";
import flame from "@tabler/icons/outline/flame.svg?raw";
import gasStation from "@tabler/icons/outline/gas-station.svg?raw";
import handStop from "@tabler/icons/outline/hand-stop.svg?raw";
import parking from "@tabler/icons/outline/parking.svg?raw";
import { DivIcon } from "leaflet";
import taxiStand from "./icons/taxi-stand.svg?raw";
import type { LayerType } from "../entity/LayerType";
import type { RecommendationKind } from "../entity/RecommendationKind";

/** Each layer's icon, as an SVG string. */
export const LAYER_ICON: Record<LayerType, string> = {
  TAXI_STAND: taxiStand,
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
      html: LAYER_ICON[t],
      iconSize: [MARKER_PX, MARKER_PX],
      iconAnchor: [MARKER_PX / 2, MARKER_PX / 2],
      popupAnchor: [0, -MARKER_PX / 2],
    });
    icons.set(t, icon);
  }
  return icon;
}

/** A bookmark's star, on the corner of its landmark's marker (D53). */
const BOOKMARK_STAR = `<span class="marker-chip__star">${starFilled}</span>`;
const bookmarkIcons = new Map<LayerType, DivIcon>();

/** A bookmarked landmark, with the Bookmarks filter on: its layer's marker with a star on its corner (D53). */
export function bookmarkIcon(t: LayerType): DivIcon {
  let icon = bookmarkIcons.get(t);
  if (!icon) {
    icon = new DivIcon({
      className: `marker-chip marker-chip--${GROUP[t]} marker-chip--bookmarked`,
      html: LAYER_ICON[t] + BOOKMARK_STAR,
      iconSize: [MARKER_PX, MARKER_PX],
      iconAnchor: [MARKER_PX / 2, MARKER_PX / 2],
      popupAnchor: [0, -MARKER_PX / 2],
    });
    bookmarkIcons.set(t, icon);
  }
  return icon;
}

const highlightIcons = new Map<LayerType, DivIcon>();

/** A chosen bookmark's landmark: its starred marker in a ring, so it stands out (UC 0011 step 3). */
export function highlightIcon(t: LayerType): DivIcon {
  let icon = highlightIcons.get(t);
  if (!icon) {
    icon = new DivIcon({
      className: `marker-chip marker-chip--${GROUP[t]} marker-chip--bookmarked marker-chip--highlighted`,
      html: LAYER_ICON[t] + BOOKMARK_STAR,
      iconSize: [MARKER_PX, MARKER_PX],
      iconAnchor: [MARKER_PX / 2, MARKER_PX / 2],
      popupAnchor: [0, -MARKER_PX / 2],
    });
    highlightIcons.set(t, icon);
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
    html: `${LAYER_ICON[t]}<span>${count}</span>`,
    iconSize: [px, px],
    iconAnchor: [px / 2, px / 2],
  });
}

/** Suggestions take the colour of their group: pickups amber, rest stops green (the data dictionary's toggles). */
export const SUGGESTION_GROUP: Record<RecommendationKind, "find" | "rest"> = { PICKUP: "find", REST_STOP: "rest" };

/** Each suggestion's icon, on its toggle in the menu and its pins (D52): a hand hailing a taxi, and a cup. */
export const SUGGESTION_ICON: Record<RecommendationKind, string> = { PICKUP: handStop, REST_STOP: cup };

const PIN_WIDTH = 46;
const PIN_HEIGHT = 28;
const PIN_TAIL = 7;
const suggestionIcons = new Map<string, DivIcon>();

/**
 * The mockup's pin: a bubble with the suggestion's icon (D52) and the site's place in the ranking (D34). Its tail stops
 * at the top of the landmark's own marker, so both stay readable.
 */
export function suggestionIcon(k: RecommendationKind, place: number): DivIcon {
  const key = `${k}-${place}`;
  let icon = suggestionIcons.get(key);
  if (!icon) {
    icon = new DivIcon({
      className: `suggestion-pin suggestion-pin--${SUGGESTION_GROUP[k]}`,
      html: `<span class="suggestion-pin__bubble">${SUGGESTION_ICON[k]}${place}</span>`,
      iconSize: [PIN_WIDTH, PIN_HEIGHT],
      iconAnchor: [PIN_WIDTH / 2, PIN_HEIGHT + PIN_TAIL + MARKER_PX / 2],
      popupAnchor: [0, -(PIN_HEIGHT + PIN_TAIL + MARKER_PX / 2)],
    });
    suggestionIcons.set(key, icon);
  }
  return icon;
}
