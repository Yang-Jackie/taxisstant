import Supercluster from "supercluster";
import type { Viewport } from "../entity/Bounds";
import type { Locatable } from "../entity/Locatable";
import { Location } from "../entity/Location";

/** Nearby markers, merged into one counted bubble while zoomed out (D17). */
export interface Cluster {
  readonly id: string;
  readonly count: number;
  readonly location: Location;
  /** The zoom at which this cluster splits apart: where tapping it should take the map. */
  readonly zoomTo: number;
}

/** What the map draws for one layer: single markers, and bubbles standing in for groups of them. */
export interface LayerView<T> {
  readonly items: readonly T[];
  readonly clusters: readonly Cluster[];
}

export const EMPTY_VIEW: LayerView<never> = { items: [], clusters: [] };

/** Markers closer together than this on screen (in pixels) are merged. */
const CLUSTER_RADIUS_PX = 60;
/** From this zoom on (about street level) every marker shows on its own. */
export const LAST_CLUSTERED_ZOOM = 16;

/** One layer's items, indexed once so each pan or zoom only asks which clusters and markers are in view. */
export class LayerClusters<T extends Locatable> {
  private readonly items: readonly T[];
  private readonly index: Supercluster<{ i: number }>;

  constructor(items: readonly T[]) {
    this.items = items;
    this.index = new Supercluster<{ i: number }>({ radius: CLUSTER_RADIUS_PX, maxZoom: LAST_CLUSTERED_ZOOM });
    this.index.load(
      items.map((item, i) => {
        const { latitude, longitude } = item.getLocation();
        return { type: "Feature", geometry: { type: "Point", coordinates: [longitude, latitude] }, properties: { i } };
      }),
    );
  }

  /** The markers and clusters inside `viewport` at its zoom. */
  view({ bounds, zoom }: Viewport): LayerView<T> {
    const items: T[] = [];
    const clusters: Cluster[] = [];
    for (const feature of this.index.getClusters([bounds.west, bounds.south, bounds.east, bounds.north], zoom)) {
      const [longitude, latitude] = feature.geometry.coordinates as [number, number];
      if ("cluster" in feature.properties) {
        const { cluster_id: id, point_count: count } = feature.properties;
        clusters.push({
          id: String(id),
          count,
          location: new Location(latitude, longitude),
          zoomTo: this.index.getClusterExpansionZoom(id),
        });
      } else {
        items.push(this.items[feature.properties.i]!);
      }
    }
    return { items, clusters };
  }
}
