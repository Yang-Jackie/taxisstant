import type { Bounds, Viewport } from "../entity/Bounds";
import type { DriverPosition } from "../entity/DriverPosition";
import type { Hotspot } from "../entity/Hotspot";
import type { Landmark } from "../entity/Landmark";
import { isStaticLayer, type LayerType, type StaticLayer } from "../entity/LayerType";
import type { Locatable } from "../entity/Locatable";
import type { Location } from "../entity/Location";
import type { LayerItems, MapDataRepository } from "../entity/MapDataRepository";
import type { Taxi } from "../entity/Taxi";
import {
  LIVE_LAYERS,
  type AvailabilityLayer,
  type DataSyncController,
  type LiveData,
  type LiveLayer,
} from "./DataSyncController";
import type { DataSyncObserver } from "./DataSyncObserver";
import type { LocationObserver } from "./LocationObserver";
import type { NoticeKey } from "./Notice";
import { EMPTY_VIEW, LayerClusters, type LayerView } from "./LayerClusters";
import type { SettingsController } from "./SettingsController";
import { Store } from "./Store";

/** What the map should draw right now, per layer: the design model's `visible` (D17 adds clusters). */
export type VisibleLayers = { readonly [K in LayerType]: LayerView<LayerItems[K]> };

/** Where the map should go: the design model's focus. `seq` changes every time, so the same place can be asked for twice. */
export interface MapFocus {
  readonly location: Location;
  readonly zoom: number;
  readonly seq: number;
}

export interface MapDisplayState {
  readonly visible: VisibleLayers;
  /** A message for the user, shown as a toast (D3), in their language (FR-2.1.2). */
  readonly notice: NoticeKey | null;
  /** The driver's dot: the design model's driverLocation (UC 0013). */
  readonly driver: DriverPosition | null;
  readonly focus: MapFocus | null;
  /** The driver's dot is away from the middle of the screen: the re-centre button lights up (UC 0013 3a, D31). */
  readonly driverOffCentre: boolean;
  /** Layers just turned on whose data is still on its way (NF-3: the driver sees it's coming). */
  readonly loading: ReadonlySet<LayerType>;
  /** A landmark shown highlighted, its details open: a chosen bookmark (UC 0011 step 3). */
  readonly highlighted: Landmark | null;
}

/** Centring on the driver zooms in at least this far: street level, where taxi stands and carparks show one by one. */
const DRIVER_ZOOM = 15;

/** Hotspots turned on when no station is busy: not a failure, but the empty map needs a word (D23). */
const NO_HOTSPOTS: NoticeKey = "noHotspots";

/** Live layers and suggestions are polled together this often while any is on and the app is in front (D25). */
export const LIVE_POLL_MS = 30_000;

/** The layers whose live data the timer asks for: the live layers, and the ones with live availability (D25). */
const POLLED: readonly (LiveLayer | AvailabilityLayer)[] = ["TAXIS", "HOTSPOT", "CARPARK", "CHARGING"];

const isLive = (t: LayerType): t is LiveLayer => (LIVE_LAYERS as readonly LayerType[]).includes(t);
const inside = (b: Bounds, l: Location) =>
  l.latitude >= b.south && l.latitude <= b.north && l.longitude >= b.west && l.longitude <= b.east;

/** The middle half of a rectangle: a quarter in from each side. */
const middleOf = (b: Bounds): Bounds => {
  const dLat = (b.north - b.south) / 4;
  const dLon = (b.east - b.west) / 4;
  return { south: b.south + dLat, north: b.north - dLat, west: b.west + dLon, east: b.east - dLon };
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

export class MapDisplayController extends Store<MapDisplayState> implements DataSyncObserver, LocationObserver {
  private readonly settings: SettingsController;
  private readonly dataSync: DataSyncController;
  private readonly repo: MapDataRepository;
  private readonly clusters = new Map<LayerType, LayerClusters<Locatable>>();
  private viewport: Viewport = SINGAPORE_VIEW;
  private timer: ReturnType<typeof setInterval> | undefined;
  private foreground = false;
  private centredOnLiveFix = false;
  /** Live data the driver has been told is out of date, until it is current again (D49). */
  private readonly toldOutOfDate = new Set<LiveData>();

  constructor(settings: SettingsController, dataSync: DataSyncController, repo: MapDataRepository) {
    super({
      visible: nothingVisible,
      notice: null,
      driver: null,
      focus: null,
      driverOffCentre: false,
      highlighted: null,
      loading: new Set(),
    });
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
    if (on) await this.show(t);
  }

  /** Loads layers that something else just turned on in the settings: a suggestion's related layers (D35). */
  async showLayers(layers: readonly LayerType[]): Promise<void> {
    await Promise.all(layers.map((t) => this.show(t)));
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

  /**
   * The driver moved (LocationController). The map centres on the session's first live fix, and opens on a saved
   * position until then; after that it never moves by itself (D31).
   */
  onLocationUpdated(position: DriverPosition): void {
    this.setState({ ...this.getSnapshot(), driver: position });
    if (position.live && !this.centredOnLiveFix) {
      this.centredOnLiveFix = true;
      this.focusOn(position.location);
    } else if (!position.live && !this.getSnapshot().focus) {
      this.focusOn(position.location);
    }
    this.recompute();
  }

  /** The design model's focusOn: move the map to `loc`, zoomed in to at least street level. */
  focusOn(loc: Location): void {
    const seq = (this.getSnapshot().focus?.seq ?? 0) + 1;
    this.setState({
      ...this.getSnapshot(),
      focus: { location: loc, zoom: Math.max(this.viewport.zoom, DRIVER_ZOOM), seq },
    });
  }

  /** Shows `l` highlighted with its details open, whatever layers are on, and moves the map to it (UC 0011 3–4). */
  highlight(l: Landmark): void {
    this.setState({ ...this.getSnapshot(), highlighted: l });
    this.focusOn(l.location);
  }

  /** `l`'s highlighted details were closed. A later highlight (of another landmark) stays. */
  clearHighlight(l: Landmark): void {
    if (this.getSnapshot().highlighted === l) this.setState({ ...this.getSnapshot(), highlighted: null });
  }

  /** The re-centre button (UC 0013 3a). */
  centreOnDriver(): void {
    const driver = this.getSnapshot().driver;
    if (driver) this.focusOn(driver.location);
  }

  /** The app's one toast (D3): a newer message replaces the one showing. */
  showNotice(notice: NoticeKey): void {
    this.setState({ ...this.getSnapshot(), notice });
  }

  dismissNotice(): void {
    this.setState({ ...this.getSnapshot(), notice: null });
  }

  /** A layer that was just turned on: its data, and availability now rather than at the next poll. */
  private async show(t: LayerType): Promise<void> {
    this.setLoading(t, true);
    try {
      if ((POLLED as readonly LayerType[]).includes(t) && !isLive(t)) void this.dataSync.refreshLive(new Set([t]));
      if (isStaticLayer(t)) await this.load(t);
      if (isLive(t)) await this.loadLive(t);
    } finally {
      this.setLoading(t, false);
    }
  }

  private setLoading(t: LayerType, on: boolean): void {
    const loading = new Set(this.getSnapshot().loading);
    if (on) loading.add(t);
    else loading.delete(t);
    this.setState({ ...this.getSnapshot(), loading });
  }

  private async load(t: StaticLayer): Promise<void> {
    try {
      await this.dataSync.refreshLayer(t);
    } catch {
      await this.settings.setLayerVisible(t, false);
      this.showNotice(`loadFailed.${t}`); // each use case's exception 4a
    }
  }

  private async loadLive(t: LiveLayer): Promise<void> {
    try {
      await this.dataSync.refreshLiveLayer(t);
    } catch {
      await this.settings.setLayerVisible(t, false);
      this.showNotice(`loadFailed.${t}`); // each use case's exception 4a
      return;
    }
    if (t === "HOTSPOT" && !this.repo.getByLayerType("HOTSPOT").some((h) => h.isCurrent(new Date()))) {
      this.showNotice(NO_HOTSPOTS);
    }
  }

  private polledLayers(): Set<LayerType> {
    return new Set(POLLED.filter((t) => this.settings.isLayerVisible(t)));
  }

  /** The timer runs only while the app is in front and something it polls is on: no wasted data or battery. */
  private updatePolling(): void {
    const { activeSuggestions } = this.settings.getPreferences();
    const needed = this.foreground && (this.polledLayers().size > 0 || activeSuggestions.size > 0);
    if (needed && !this.timer) this.timer = setInterval(() => void this.poll(), LIVE_POLL_MS);
    if (!needed && this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  /**
   * One tick: ask for the live data and suggestions that are on, then recompute, since data ages even when nothing new
   * arrives (D22).
   */
  private async poll(): Promise<void> {
    const layers = this.polledLayers();
    const { activeSuggestions } = this.settings.getPreferences();
    if (layers.size > 0 || activeSuggestions.size > 0) await this.dataSync.refreshLive(layers, activeSuggestions);
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
    const driver = this.getSnapshot().driver;
    const screen = this.viewport.screen ?? this.viewport.bounds;
    const driverOffCentre = driver !== null && !inside(middleOf(screen), driver.location);
    this.setState({ ...this.getSnapshot(), visible, driverOffCentre });
    this.announceOutOfDate(now);
  }

  /**
   * Tells the driver, once, when live data they have on goes out of date (D49): one layer, its free lots or a
   * suggestion by name, or several together. Told again only after it has been current again.
   */
  private announceOutOfDate(now: Date): void {
    const { visibleLayers, activeSuggestions } = this.settings.getPreferences();
    const watched: LiveData[] = [...POLLED.filter((t) => visibleLayers.has(t)), ...activeSuggestions];
    const stale = new Set(watched.filter((k) => this.dataSync.isLiveCurrent(k, now) === false));
    for (const k of this.toldOutOfDate) if (!stale.has(k)) this.toldOutOfDate.delete(k); // current again, or off
    const untold = [...stale].filter((k) => !this.toldOutOfDate.has(k));
    if (untold.length === 0) return;
    for (const k of untold) this.toldOutOfDate.add(k);
    this.showNotice(stale.size === 1 ? `outOfDate.${untold[0]!}` : "outOfDate.several");
  }
}
