import type { Bounds, Viewport } from "../entity/Bounds";
import type { Hotspot } from "../entity/Hotspot";
import { isStaticLayer, type LayerType, type StaticLayer } from "../entity/LayerType";
import type { Locatable } from "../entity/Locatable";
import type { Location } from "../entity/Location";
import type { LayerItems, MapDataRepository } from "../entity/MapDataRepository";
import type { Taxi } from "../entity/Taxi";
import { LIVE_LAYERS, type DataSyncController, type LiveLayer } from "./DataSyncController";
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

/** Each layer's toast when it can't be loaded, worded as in UC 0001–0007 (exception 4a). */
const LOAD_FAILED: Record<StaticLayer | LiveLayer, string> = {
  TAXIS: "Unable to load nearby taxi markers. Please check your connection.",
  HOTSPOT: "Unable to load hotspot markers. Please check your connection.",
  TAXI_STAND: "Unable to load taxi stand markers. Please check your connection.",
  CARPARK: "Unable to load carpark markers. Please check your connection.",
  FUEL: "Unable to load fuel station markers. Please check your connection.",
  CHARGING: "Unable to load charging point markers. Please check your connection.",
  HAWKER: "Unable to load hawker centre markers. Please check your connection.",
};

/** Hotspots turned on when no station is busy: not a failure, but the empty map needs a word (D23). */
const NO_HOTSPOTS = "No stations are crowded right now.";

/** Live layers are polled together this often while any is on and the app is in front (D25). */
export const LIVE_POLL_MS = 30_000;

/** The layers whose live data the timer asks for: the live layers, and the ones with live availability (D25). */
const POLLED: readonly LayerType[] = ["TAXIS", "HOTSPOT", "CARPARK", "CHARGING"];

const isLive = (t: LayerType): t is LiveLayer => (LIVE_LAYERS as readonly LayerType[]).includes(t);
const inside = (b: Bounds, l: Location) =>
  l.latitude >= b.south && l.latitude <= b.north && l.longitude >= b.west && l.longitude <= b.east;

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
  private timer: ReturnType<typeof setInterval> | undefined;
  private foreground = false;

  constructor(settings: SettingsController, dataSync: DataSyncController, repo: MapDataRepository) {
    super({ visible: nothingVisible, notice: null });
    this.settings = settings;
    this.dataSync = dataSync;
    this.repo = repo;
    settings.subscribe(() => {
      this.recompute();
      this.updatePolling();
    });
  }

  /** At startup: load whatever layers an earlier session left on. */
  async start(): Promise<void> {
    const on = [...this.settings.getPreferences().visibleLayers];
    await Promise.all([
      ...on.filter(isStaticLayer).map((t) => this.load(t)),
      ...on.filter(isLive).map((t) => this.loadLive(t)),
    ]);
  }

  async toggleLayer(t: LayerType): Promise<void> {
    const on = !this.settings.isLayerVisible(t);
    await this.settings.setLayerVisible(t, on);
    if (on && POLLED.includes(t) && !isLive(t)) void this.dataSync.refreshLive(new Set([t])); // availability now, not in 30 s
    if (on && isStaticLayer(t)) await this.load(t);
    if (on && isLive(t)) await this.loadLive(t);
  }

  /**
   * The app came to the front (true) or went to the background (false): polling runs only in front (D25).
   * Coming back, live data is asked for at once.
   */
  setForeground(on: boolean): void {
    this.foreground = on;
    this.updatePolling();
    if (on) void this.poll();
  }

  /** The map moved or zoomed (MapView.onPan): show what's in view, clustered for that zoom (FR-1.5.3). */
  refreshVisible(viewport: Viewport): void {
    // Leaflet reports "moves" of zero pixels (e.g. while fitting a popup); recomputing for those could loop forever
    if (sameViewport(viewport, this.viewport)) return;
    this.viewport = viewport;
    this.recompute();
  }

  onDataUpdated(t: LayerType): void {
    if (t !== "HOTSPOT") this.clusters.set(t, new LayerClusters<Locatable>(this.repo.getByLayerType(t)));
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

  private async loadLive(t: LiveLayer): Promise<void> {
    try {
      await this.dataSync.refreshLiveLayer(t);
    } catch {
      await this.settings.setLayerVisible(t, false);
      this.setState({ ...this.getSnapshot(), notice: LOAD_FAILED[t] });
      return;
    }
    if (t === "HOTSPOT" && !this.repo.getByLayerType("HOTSPOT").some((h) => h.isCurrent(new Date()))) {
      this.setState({ ...this.getSnapshot(), notice: NO_HOTSPOTS });
    }
  }

  private polledLayers(): Set<LayerType> {
    return new Set(POLLED.filter((t) => this.settings.isLayerVisible(t)));
  }

  /** The timer runs only while the app is in front and something it polls is on: no wasted data or battery. */
  private updatePolling(): void {
    const needed = this.foreground && this.polledLayers().size > 0;
    if (needed && !this.timer) this.timer = setInterval(() => void this.poll(), LIVE_POLL_MS);
    if (!needed && this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  /** One tick: ask for the live data that's on, then recompute, since data ages even when nothing new arrives (D22). */
  private async poll(): Promise<void> {
    const layers = this.polledLayers();
    if (layers.size > 0) await this.dataSync.refreshLive(layers);
    this.recompute();
  }

  /** Taxis share one snapshot time: all of them show, or none once it is over 5 minutes old (D22, D24). */
  private taxisView(now: Date): LayerView<Taxi> {
    const snapshot = this.repo.getByLayerType("TAXIS")[0];
    return snapshot?.isFresh(now) ? this.viewOf("TAXIS") : EMPTY_VIEW;
  }

  /** Hotspots are few and drawn as circles, so they aren't clustered; only current ones in view show (D22, D23). */
  private hotspotView(now: Date): LayerView<Hotspot> {
    if (!this.settings.isLayerVisible("HOTSPOT")) return EMPTY_VIEW;
    const items = this.repo
      .getByLayerType("HOTSPOT")
      .filter((h) => h.isCurrent(now) && inside(this.viewport.bounds, h.centre));
    return { items, clusters: [] };
  }

  private viewOf<K extends LayerType>(t: K): LayerView<LayerItems[K]> {
    if (!this.settings.isLayerVisible(t)) return EMPTY_VIEW;
    // The one cast: onDataUpdated(t) indexes exactly repo.getByLayerType(t), which holds LayerItems[t]
    return (this.clusters.get(t)?.view(this.viewport) ?? EMPTY_VIEW) as LayerView<LayerItems[K]>;
  }

  private recompute(): void {
    const now = new Date();
    const visible: VisibleLayers = {
      TAXI_STAND: this.viewOf("TAXI_STAND"),
      TAXIS: this.taxisView(now),
      HOTSPOT: this.hotspotView(now),
      CARPARK: this.viewOf("CARPARK"),
      FUEL: this.viewOf("FUEL"),
      CHARGING: this.viewOf("CHARGING"),
      HAWKER: this.viewOf("HAWKER"),
    };
    this.setState({ ...this.getSnapshot(), visible });
  }
}
