// M6 acceptance tests — MapDisplayController «control»: decides what the map shows. It runs UC 0001:
// toggle → settings (saved) → load data if needed → show; on failure, switch back and set a notice (D3).
// M7: with a copy saved by an earlier session, a failure no longer matters (D1).
// Package 2b: every static layer (UC 0004–0007), only what is in view (refreshVisible), clustered when zoomed out (D17).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Viewport } from "../entity/Bounds";
import { STATIC_LAYERS, type StaticLayer } from "../entity/LayerType";
import { MapDataRepository } from "../entity/MapDataRepository";
import { CacheManager } from "../services/CacheManager";
import { DataApiClient } from "../services/DataApiClient";
import { callsTo, fakeServer, hotspotsAt, offline, ok, status, TAXIS, type Answer } from "../testing/fakeServer";
import { DataSyncController, type LiveLayer } from "./DataSyncController";
import { LIVE_POLL_MS, MapDisplayController, SINGAPORE_VIEW } from "./MapDisplayController";
import { SettingsController } from "./SettingsController";

function memoryStore(initial: Record<string, unknown> = {}) {
  const data = new Map<string, unknown>(Object.entries(initial));
  return { data, read: async (k: string) => data.get(k), write: async (k: string, v: unknown) => void data.set(k, v) };
}

/** Street level over the whole island: every marker on its own, nothing clustered. */
const STREET_LEVEL: Viewport = { bounds: SINGAPORE_VIEW.bounds, zoom: 18 };

/** Wires the real controllers together the way startup.ts does, with a fake server and in-memory storage. */
function setUp(answers: Record<string, Answer> = {}, store = memoryStore()) {
  const fetchFn = fakeServer(answers);
  const repo = new MapDataRepository();
  const settings = new SettingsController(store);
  const dataSync = new DataSyncController(new DataApiClient({ fetchFn }), repo, new CacheManager(store));
  const mapDisplay = new MapDisplayController(settings, dataSync, repo);
  dataSync.attach(mapDisplay);
  mapDisplay.refreshVisible(STREET_LEVEL);
  return { fetchFn, settings, dataSync, mapDisplay };
}

const ids = (mapDisplay: MapDisplayController, t: StaticLayer) =>
  mapDisplay.getSnapshot().visible[t].items.map((i) => i.id);

describe("MapDisplayController", () => {
  it("starts with nothing on the map and no notice", () => {
    const { mapDisplay } = setUp();
    const { visible, notice } = mapDisplay.getSnapshot();
    for (const view of Object.values(visible)) expect(view).toEqual({ items: [], clusters: [] });
    expect(Object.keys(visible).sort()).toEqual([
      "CARPARK",
      "CHARGING",
      "FUEL",
      "HAWKER",
      "HOTSPOT",
      "TAXIS",
      "TAXI_STAND",
    ]);
    expect(notice).toBeNull();
  });

  it("toggleLayer turns Taxi stands on in the settings and shows the stands once loaded", async () => {
    const { settings, mapDisplay } = setUp();

    await mapDisplay.toggleLayer("TAXI_STAND");

    expect(settings.isLayerVisible("TAXI_STAND")).toBe(true);
    expect(ids(mapDisplay, "TAXI_STAND")).toEqual(["A01", "A05", "A06"]);
  });

  it("toggleLayer again turns them off and clears them from the map", async () => {
    const { settings, mapDisplay } = setUp();

    await mapDisplay.toggleLayer("TAXI_STAND");
    await mapDisplay.toggleLayer("TAXI_STAND");

    expect(settings.isLayerVisible("TAXI_STAND")).toBe(false);
    expect(mapDisplay.getSnapshot().visible.TAXI_STAND).toEqual({ items: [], clusters: [] });
  });

  it("on a load failure, switches the layer back off and sets a notice (UC 0001 exception 4a)", async () => {
    const { settings, mapDisplay } = setUp({ "/taxi-stands": status(503) });

    await mapDisplay.toggleLayer("TAXI_STAND");

    expect(settings.isLayerVisible("TAXI_STAND")).toBe(false);
    expect(mapDisplay.getSnapshot().notice).toMatch(/unable to load taxi stand markers/i);
    expect(ids(mapDisplay, "TAXI_STAND")).toEqual([]);
  });

  it("dismissNotice clears the notice", async () => {
    const { mapDisplay } = setUp({ "/taxi-stands": status(503) });
    await mapDisplay.toggleLayer("TAXI_STAND");

    mapDisplay.dismissNotice();

    expect(mapDisplay.getSnapshot().notice).toBeNull();
  });

  it("start() loads and shows Taxi stands if a previous session left them on", async () => {
    const { settings, mapDisplay } = setUp({}, memoryStore({ preferences: { visibleLayers: ["TAXI_STAND"] } }));

    await settings.load();
    await mapDisplay.start();

    expect(ids(mapDisplay, "TAXI_STAND")).toHaveLength(3);
  });

  it("start() does nothing if every layer was left off", async () => {
    const { fetchFn, settings, mapDisplay } = setUp();
    await settings.load();
    await mapDisplay.start();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("notifies subscribers when what the map shows changes", async () => {
    const { mapDisplay } = setUp();
    const listener = vi.fn();
    mapDisplay.subscribe(listener);

    await mapDisplay.toggleLayer("TAXI_STAND");

    expect(listener).toHaveBeenCalled();
  });

  it("toggling on with no connection still shows the stands if an earlier session saved them — no notice (D1)", async () => {
    const store = memoryStore();
    const first = setUp({}, store);
    await first.mapDisplay.toggleLayer("TAXI_STAND"); // on: downloads and saves them
    await first.mapDisplay.toggleLayer("TAXI_STAND"); // off again

    const { settings, dataSync, mapDisplay } = setUp({ "*": offline }, store);
    await settings.load();
    await dataSync.loadCached();
    await mapDisplay.start();
    await mapDisplay.toggleLayer("TAXI_STAND");

    expect(settings.isLayerVisible("TAXI_STAND")).toBe(true);
    expect(ids(mapDisplay, "TAXI_STAND")).toEqual(["A01", "A05", "A06"]);
    expect(mapDisplay.getSnapshot().notice).toBeNull();
  });
});

describe("MapDisplayController — every static layer (package 2b, UC 0004–0007)", () => {
  it("shows each layer's own items when it is toggled on, and only those layers", async () => {
    const { mapDisplay } = setUp();

    await mapDisplay.toggleLayer("CARPARK");
    await mapDisplay.toggleLayer("HAWKER");

    expect(ids(mapDisplay, "CARPARK")).toEqual(["1", "A2"]);
    expect(ids(mapDisplay, "HAWKER")).toEqual(["adam-road-food-centre"]);
    expect(ids(mapDisplay, "FUEL")).toEqual([]);
    expect(ids(mapDisplay, "TAXI_STAND")).toEqual([]);
  });

  const toasts: [StaticLayer, string, RegExp][] = [
    ["TAXI_STAND", "/taxi-stands", /^Unable to load taxi stand markers\. Please check your connection\.$/],
    ["CARPARK", "/carparks", /^Unable to load carpark markers\. Please check your connection\.$/],
    ["FUEL", "/fuel-stations", /^Unable to load fuel station markers\. Please check your connection\.$/],
    ["CHARGING", "/charging-stations", /^Unable to load charging point markers\. Please check your connection\.$/],
    ["HAWKER", "/hawker-centres", /^Unable to load hawker centre markers\. Please check your connection\.$/],
  ];
  for (const [layer, path, toast] of toasts) {
    it(`gives ${layer} its own toast when it can't be loaded, worded as in its use case`, async () => {
      const { settings, mapDisplay } = setUp({ [path]: status(503) });

      await mapDisplay.toggleLayer(layer);

      expect(mapDisplay.getSnapshot().notice).toMatch(toast);
      expect(settings.isLayerVisible(layer)).toBe(false);
    });
  }

  it("covers every static layer in those toasts", () => {
    expect(toasts.map(([t]) => t).sort()).toEqual([...STATIC_LAYERS].sort());
  });

  it("start() loads every static layer a previous session left on", async () => {
    const { fetchFn, settings, mapDisplay } = setUp(
      {},
      memoryStore({ preferences: { visibleLayers: ["FUEL", "CHARGING"] } }),
    );

    await settings.load();
    await mapDisplay.start();

    expect(ids(mapDisplay, "FUEL")).toHaveLength(1);
    expect(ids(mapDisplay, "CHARGING")).toHaveLength(1);
    expect(callsTo(fetchFn, "/carparks")).toBe(0);
  });

  it("shows a layer instantly when the startup prefetch already has it: no second download", async () => {
    const { fetchFn, dataSync, mapDisplay } = setUp();
    await dataSync.refreshStatic();

    await mapDisplay.toggleLayer("CHARGING");

    expect(ids(mapDisplay, "CHARGING")).toEqual(["179024:103.846728"]);
    expect(callsTo(fetchFn, "/charging-stations")).toBe(1);
  });
});

describe("MapDisplayController.refreshVisible — what's in view, at what zoom (FR-1.5.3, D17)", () => {
  it("keeps only the items inside the view", async () => {
    const { mapDisplay } = setUp();
    await mapDisplay.toggleLayer("CARPARK");

    mapDisplay.refreshVisible({ bounds: { south: 1.28, west: 103.84, north: 1.3, east: 103.87 }, zoom: 18 }); // Marina only

    expect(ids(mapDisplay, "CARPARK")).toEqual(["1"]);
  });

  it("clusters nearby items when zoomed out, and splits them when zoomed in", async () => {
    const { mapDisplay } = setUp();
    await mapDisplay.toggleLayer("TAXI_STAND"); // three stands within 400 m of each other in Orchard

    mapDisplay.refreshVisible(SINGAPORE_VIEW);
    const zoomedOut = mapDisplay.getSnapshot().visible.TAXI_STAND;
    expect(zoomedOut.items).toEqual([]);
    expect(zoomedOut.clusters.map((c) => c.count)).toEqual([3]);

    mapDisplay.refreshVisible(STREET_LEVEL);
    expect(mapDisplay.getSnapshot().visible.TAXI_STAND).toMatchObject({ clusters: [] });
    expect(ids(mapDisplay, "TAXI_STAND")).toHaveLength(3);
  });

  it("shows the whole island at the start zoom until the map reports its own view", async () => {
    const fetchFn = fakeServer();
    const repo = new MapDataRepository();
    const store = memoryStore();
    const settings = new SettingsController(store);
    const dataSync = new DataSyncController(new DataApiClient({ fetchFn }), repo, new CacheManager(store));
    const mapDisplay = new MapDisplayController(settings, dataSync, repo);
    dataSync.attach(mapDisplay);

    await mapDisplay.toggleLayer("TAXI_STAND");

    expect(mapDisplay.getSnapshot().visible.TAXI_STAND.clusters.map((c) => c.count)).toEqual([3]); // zoom 12: clustered
  });

  it("ignores a view it is already showing, so a zero-pixel 'move' can't start a render loop", async () => {
    const { mapDisplay } = setUp();
    await mapDisplay.toggleLayer("TAXI_STAND");
    const listener = vi.fn();
    mapDisplay.subscribe(listener);
    const before = mapDisplay.getSnapshot();

    mapDisplay.refreshVisible({ bounds: { ...STREET_LEVEL.bounds }, zoom: STREET_LEVEL.zoom }); // equal, not the same object

    expect(listener).not.toHaveBeenCalled();
    expect(mapDisplay.getSnapshot()).toBe(before);
  });

  it("uses the latest view for data that arrives later", async () => {
    const { dataSync, settings, mapDisplay } = setUp();
    await settings.setLayerVisible("CARPARK", true);
    mapDisplay.refreshVisible({ bounds: { south: 1.36, west: 103.83, north: 1.37, east: 103.85 }, zoom: 18 }); // Ang Mo Kio

    await dataSync.refreshLayer("CARPARK");

    expect(ids(mapDisplay, "CARPARK")).toEqual(["A2"]);
  });
});

// Package 2d — live layers: taxis (D24) and hotspots (D23), age limits (D22), polling every 30 s together (D25).
describe("MapDisplayController — live layers (package 2d)", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("toggling Nearby taxis on downloads them and shows each taxi at street level", async () => {
    const { fetchFn, settings, mapDisplay } = setUp();

    await mapDisplay.toggleLayer("TAXIS");

    expect(settings.isLayerVisible("TAXIS")).toBe(true);
    expect(callsTo(fetchFn, "/taxis")).toBe(1);
    expect(mapDisplay.getSnapshot().visible.TAXIS.items).toHaveLength(4);
  });

  it("clusters taxis when zoomed out: density as counts (FR-1.2.2, D24)", async () => {
    const { mapDisplay } = setUp();
    await mapDisplay.toggleLayer("TAXIS");

    mapDisplay.refreshVisible(SINGAPORE_VIEW);

    const { items, clusters } = mapDisplay.getSnapshot().visible.TAXIS;
    expect(clusters.map((c) => c.count)).toEqual([3]); // the three in Orchard
    expect(items).toHaveLength(1); // the one in Jurong
  });

  it("shows only busy stations as hotspots, never clustered (D23)", async () => {
    const { mapDisplay } = setUp();
    await mapDisplay.toggleLayer("HOTSPOT");
    mapDisplay.refreshVisible(SINGAPORE_VIEW);

    const { items, clusters } = mapDisplay.getSnapshot().visible.HOTSPOT;
    expect(items.map((h) => h.id).sort()).toEqual(["city-hall", "dhoby-ghaut"]);
    expect(clusters).toEqual([]);
  });

  it("says so when no station is crowded, and keeps Hotspots on: an empty map isn't a failure", async () => {
    const quiet = () => hotspotsAt(new Date()).map((h) => ({ ...h, density: "LOW" as const }));
    const { settings, mapDisplay } = setUp({ "/hotspots": ok(quiet) });

    await mapDisplay.toggleLayer("HOTSPOT");

    expect(mapDisplay.getSnapshot().notice).toBe("No stations are crowded right now.");
    expect(settings.isLayerVisible("HOTSPOT")).toBe(true);
  });

  const toasts: [LiveLayer, string, RegExp][] = [
    ["TAXIS", "/taxis", /^Unable to load nearby taxi markers\. Please check your connection\.$/],
    ["HOTSPOT", "/hotspots", /^Unable to load hotspot markers\. Please check your connection\.$/],
  ];
  for (const [layer, path, toast] of toasts) {
    it(`gives ${layer} its use case's toast and switches back when nothing can be shown (UC 0002/0003)`, async () => {
      const { settings, mapDisplay } = setUp({ [path]: status(503) });

      await mapDisplay.toggleLayer(layer);

      expect(mapDisplay.getSnapshot().notice).toMatch(toast);
      expect(settings.isLayerVisible(layer)).toBe(false);
    });
  }

  it("takes taxis off the map once they are over 5 minutes old, even with no new data (D22)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-28T13:00:00Z"));
    let online = true;
    const { mapDisplay } = setUp({ "/taxis": (init) => (online ? ok(TAXIS)(init) : offline(init)) });
    await mapDisplay.toggleLayer("TAXIS");
    mapDisplay.setForeground(true);
    online = false;

    await vi.advanceTimersByTimeAsync(4.5 * 60 * 1000);
    expect(mapDisplay.getSnapshot().visible.TAXIS.items).toHaveLength(4);

    await vi.advanceTimersByTimeAsync(60 * 1000);
    expect(mapDisplay.getSnapshot().visible.TAXIS.items).toHaveLength(0);
    mapDisplay.setForeground(false);
  });

  it("takes a hotspot off the map once its slot ended over 30 minutes ago (D22)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-28T13:00:00Z"));
    const { mapDisplay } = setUp({ "/hotspots": ok(hotspotsAt(new Date("2026-10-28T13:00:00Z"))) }); // slot ended 12:45
    await mapDisplay.toggleLayer("HOTSPOT");
    mapDisplay.setForeground(true);

    await vi.advanceTimersByTimeAsync(14 * 60 * 1000); // 13:14: the slot ended 29 minutes ago
    expect(mapDisplay.getSnapshot().visible.HOTSPOT.items).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(2 * 60 * 1000); // 13:16: 31 minutes
    expect(mapDisplay.getSnapshot().visible.HOTSPOT.items).toHaveLength(0);
    mapDisplay.setForeground(false);
  });
});

describe("MapDisplayController — polling (D25)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("asks for the live layers that are on every 30 seconds, together", async () => {
    const { fetchFn, mapDisplay } = setUp();
    await mapDisplay.toggleLayer("TAXIS");
    await mapDisplay.toggleLayer("HOTSPOT");
    mapDisplay.setForeground(true);
    await vi.advanceTimersByTimeAsync(0);
    fetchFn.mockClear();

    await vi.advanceTimersByTimeAsync(LIVE_POLL_MS);

    expect(callsTo(fetchFn, "/taxis")).toBe(1);
    expect(callsTo(fetchFn, "/hotspots")).toBe(1);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    mapDisplay.setForeground(false);
  });

  it("keeps carpark and charger availability current: asks every 30 seconds while those layers are on", async () => {
    const { fetchFn, mapDisplay } = setUp();
    await mapDisplay.toggleLayer("CARPARK");
    mapDisplay.setForeground(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(mapDisplay.getSnapshot().visible.CARPARK.items.map((c) => c.availableLots)).toEqual([117, 3]);
    fetchFn.mockClear();

    await vi.advanceTimersByTimeAsync(LIVE_POLL_MS);

    expect(callsTo(fetchFn, "/carparks/availability")).toBe(1);
    mapDisplay.setForeground(false);
  });

  it("asks for availability as soon as Carpark or Charge is turned on, not at the next tick", async () => {
    const { fetchFn, mapDisplay } = setUp();
    mapDisplay.setForeground(true);
    fetchFn.mockClear();

    await mapDisplay.toggleLayer("CHARGING");
    await vi.advanceTimersByTimeAsync(0); // no time passes: no timer tick

    expect(callsTo(fetchFn, "/charging-stations/availability")).toBe(1);
    expect(mapDisplay.getSnapshot().visible.CHARGING.items[0]?.availablePoints).toBe(2);
    mapDisplay.setForeground(false);
  });

  it("asks for nothing while no live layer (or availability layer) is on", async () => {
    const { fetchFn, mapDisplay } = setUp();
    await mapDisplay.toggleLayer("FUEL");
    mapDisplay.setForeground(true);
    fetchFn.mockClear();

    await vi.advanceTimersByTimeAsync(5 * LIVE_POLL_MS);

    expect(fetchFn).not.toHaveBeenCalled();
    mapDisplay.setForeground(false);
  });

  it("stops while the app is in the background, and asks at once when it comes back", async () => {
    const { fetchFn, mapDisplay } = setUp();
    await mapDisplay.toggleLayer("TAXIS");
    mapDisplay.setForeground(true);
    await vi.advanceTimersByTimeAsync(0);
    mapDisplay.setForeground(false);
    fetchFn.mockClear();

    await vi.advanceTimersByTimeAsync(5 * LIVE_POLL_MS);
    expect(fetchFn).not.toHaveBeenCalled();

    mapDisplay.setForeground(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(callsTo(fetchFn, "/taxis")).toBe(1);
    mapDisplay.setForeground(false);
  });

  it("stops polling when the last live layer is turned off", async () => {
    const { fetchFn, mapDisplay } = setUp();
    await mapDisplay.toggleLayer("TAXIS");
    mapDisplay.setForeground(true);
    await mapDisplay.toggleLayer("TAXIS");
    fetchFn.mockClear();

    await vi.advanceTimersByTimeAsync(5 * LIVE_POLL_MS);

    expect(fetchFn).not.toHaveBeenCalled();
    mapDisplay.setForeground(false);
  });
});
