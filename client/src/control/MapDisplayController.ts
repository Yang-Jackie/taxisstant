import type { Viewport } from "../entity/Bounds";
import { isStaticLayer, type LayerType, type StaticLayer } from "../entity/LayerType";
import type { Locatable } from "../entity/Locatable";
import type { LayerItems, MapDataRepository } from "../entity/MapDataRepository";
import type { DataSyncController } from "./DataSyncController";
import type { DataSyncObserver } from "./DataSyncObserver";
import { EMPTY_VIEW, LayerClusters, type LayerView } from "./LayerClusters";
import type { SettingsController } from "./SettingsController";
import { Store } from "./Store";

/** What the map should draw right now, per layer: the design model's `visible` (D17 adds clusters). */
export type VisibleLayers = { readonly [K in LayerType]: LayerView<LayerItems[K]> };

export interface MapDisplayState {
  readonly visible: VisibleLayers;
  /** A message for the user, shown as a toast (D3). */
  readonly notice: string | null;
}

/** Each layer's toast when it can't be loaded, worded as in UC 0001 and UC 0004–0007 (exception 4a). */
const LOAD_FAILED: Record<StaticLayer, string> = {
  TAXI_STAND: "Unable to load taxi stand markers. Please check your connection.",
  CARPARK: "Unable to load carpark markers. Please check your connection.",
  FUEL: "Unable to load fuel station markers. Please check your connection.",
  CHARGING: "Unable to load charging point markers. Please check your connection.",
  HAWKER: "Unable to load hawker centre markers. Please check your connection.",
};

/** The whole of Singapore at the start zoom: what the map shows until it reports its own view. */
export const SINGAPORE_VIEW: Viewport = {
  bounds: { south: 1.144, west: 103.535, north: 1.494, east: 104.15 },
  zoom: 12,
};

const sameViewport = (a: Viewport, b: Viewport) =>
  a.zoom === b.zoom &&
  a.bounds.south === b.bounds.south &&
  a.bounds.west === b.bounds.west &&
  a.bounds.north === b.bounds.north &&
  a.bounds.east === b.bounds.east;

const nothingVisible: VisibleLayers = {
  TAXI_STAND: EMPTY_VIEW,
  TAXIS: EMPTY_VIEW,
  HOTSPOT: EMPTY_VIEW,
  CARPARK: EMPTY_VIEW,
  FUEL: EMPTY_VIEW,
  CHARGING: EMPTY_VIEW,
  HAWKER: EMPTY_VIEW,
};

export class MapDisplayController extends Store<MapDisplayState> implements DataSyncObserver {
  private readonly settings: SettingsController;
  private readonly dataSync: DataSyncController;
  private readonly repo: MapDataRepository;
  private readonly clusters = new Map<LayerType, LayerClusters<Locatable>>();
  private viewport: Viewport = SINGAPORE_VIEW;

  constructor(settings: SettingsController, dataSync: DataSyncController, repo: MapDataRepository) {
    super({ visible: nothingVisible, notice: null });
    this.settings = settings;
    this.dataSync = dataSync;
    this.repo = repo;
    settings.subscribe(() => this.recompute());
  }

  /** At startup: load whatever static layers an earlier session left on. */
  async start(): Promise<void> {
    const on = [...this.settings.getPreferences().visibleLayers].filter(isStaticLayer);
    await Promise.all(on.map((t) => this.load(t)));
  }

  async toggleLayer(t: LayerType): Promise<void> {
    const on = !this.settings.isLayerVisible(t);
    await this.settings.setLayerVisible(t, on);
    if (on && isStaticLayer(t)) await this.load(t);
  }

  /** The map moved or zoomed (MapView.onPan): show what's in view, clustered for that zoom (FR-1.5.3). */
  refreshVisible(viewport: Viewport): void {
    // Leaflet reports "moves" of zero pixels (e.g. while fitting a popup); recomputing for those could loop forever
    if (sameViewport(viewport, this.viewport)) return;
    this.viewport = viewport;
    this.recompute();
  }

  onDataUpdated(t: LayerType): void {
    this.clusters.set(t, new LayerClusters<Locatable>(this.repo.getByLayerType(t)));
    this.recompute();
  }

  dismissNotice(): void {
    this.setState({ ...this.getSnapshot(), notice: null });
  }

  private async load(t: StaticLayer): Promise<void> {
    try {
      await this.dataSync.refreshLayer(t);
    } catch {
      await this.settings.setLayerVisible(t, false);
      this.setState({ ...this.getSnapshot(), notice: LOAD_FAILED[t] });
    }
  }

  private viewOf<K extends LayerType>(t: K): LayerView<LayerItems[K]> {
    if (!this.settings.isLayerVisible(t)) return EMPTY_VIEW;
    // The one cast: onDataUpdated(t) indexes exactly repo.getByLayerType(t), which holds LayerItems[t]
    return (this.clusters.get(t)?.view(this.viewport) ?? EMPTY_VIEW) as LayerView<LayerItems[K]>;
  }

  private recompute(): void {
    const visible: VisibleLayers = {
      TAXI_STAND: this.viewOf("TAXI_STAND"),
      TAXIS: this.viewOf("TAXIS"),
      HOTSPOT: this.viewOf("HOTSPOT"),
      CARPARK: this.viewOf("CARPARK"),
      FUEL: this.viewOf("FUEL"),
      CHARGING: this.viewOf("CHARGING"),
      HAWKER: this.viewOf("HAWKER"),
    };
    this.setState({ ...this.getSnapshot(), visible });
  }
}
