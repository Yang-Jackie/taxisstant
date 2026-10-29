// OneMap basemap settings (Singapore Land Authority). Map tiles load straight from OneMap in the
// browser — no API key, and not through our server (see "map tiles (direct)" in the architecture).
import { latLngBounds, type LatLngBounds, type LatLngExpression } from "leaflet";

export const ONEMAP_TILE_URL = "https://www.onemap.gov.sg/maps/tiles/Default/{z}/{x}/{y}.png";
/** OneMap's Night style, for dark mode (D44). */
export const ONEMAP_NIGHT_TILE_URL = "https://www.onemap.gov.sg/maps/tiles/Night/{z}/{x}/{y}.png";

/** OneMap's terms ask for this logo + credit on every map that uses their tiles. */
export const ONEMAP_ATTRIBUTION =
  '<img src="https://www.onemap.gov.sg/web-assets/images/logo/om_logo.png" style="height:20px;width:20px;vertical-align:middle" alt="" />' +
  '&nbsp;<a href="https://www.onemap.gov.sg/" target="_blank" rel="noopener noreferrer">OneMap</a>' +
  "&nbsp;&copy;&nbsp;contributors&nbsp;&#124;&nbsp;" +
  '<a href="https://www.sla.gov.sg/" target="_blank" rel="noopener noreferrer">Singapore Land Authority</a>';

/** Roughly the middle of Singapore. */
export const SINGAPORE_CENTRE: LatLngExpression = [1.3521, 103.8198];

/** Singapore, from Tuas to Changi and the Straits to the Johor Strait. */
export const SINGAPORE_BOUNDS: LatLngBounds = latLngBounds([1.144, 103.535], [1.494, 104.15]);

/**
 * How far the map can be panned: Singapore with a margin (OneMap draws the area around it too), so that a popup at the
 * island's edge can still be panned clear of the controls over the map, and never off to somewhere else.
 */
export const PANNING_BOUNDS: LatLngBounds = SINGAPORE_BOUNDS.pad(0.25);

export const MIN_ZOOM = 11;
export const MAX_ZOOM = 19;
export const START_ZOOM = 12;
