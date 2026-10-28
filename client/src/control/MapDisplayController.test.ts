// M6 acceptance tests — MapDisplayController «control»: decides what the map shows. It runs UC 0001:
// toggle → settings (saved) → load data if needed → show; on failure, switch back and set a notice (D3).
// M7: with a copy saved by an earlier session, a failure no longer matters (D1).
// Package 2b: every static layer (UC 0004–0007), only what is in view (refreshVisible), clustered when zoomed out (D17).
import { describe, expect, it, vi } from "vitest";
import type { Viewport } from "../entity/Bounds";
import { STATIC_LAYERS, type StaticLayer } from "../entity/LayerType";
import { MapDataRepository } from "../entity/MapDataRepository";
import { CacheManager } from "../services/CacheManager";
import { DataApiClient } from "../services/DataApiClient";
import { callsTo, fakeServer, offline, status, type Answer } from "../testing/fakeServer";
import { DataSyncController } from "./DataSyncController";
import { MapDisplayController, SINGAPORE_VIEW } from "./MapDisplayController";
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

  it("toggling a live layer (live data comes in package 2d) only changes the setting — nothing is downloaded", async () => {
    const { fetchFn, settings, mapDisplay } = setUp();

    await mapDisplay.toggleLayer("TAXIS");

    expect(settings.isLayerVisible("TAXIS")).toBe(true);
    expect(fetchFn).not.toHaveBeenCalled();
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
