// M6 acceptance tests — MapDisplayController «control»: decides what the map shows. It runs UC 0001:
// toggle → settings (saved) → load data if needed → show; on failure, switch back and set a notice (D3).
// M7: with a copy saved by an earlier session, a failure no longer matters (D1).
import { describe, expect, it, vi } from "vitest";
import { MapDataRepository } from "../entity/MapDataRepository";
import { CacheManager } from "../services/CacheManager";
import { DataApiClient } from "../services/DataApiClient";
import { DataSyncController } from "./DataSyncController";
import { MapDisplayController } from "./MapDisplayController";
import { SettingsController } from "./SettingsController";

const stands = [
  {
    id: "A01",
    name: "Lucky Plaza",
    latitude: 1.304294727,
    longitude: 103.8338467,
    standType: "Stand",
    isBarrierFree: true,
  },
  {
    id: "A05",
    name: "Mt Elizabeth",
    latitude: 1.304571786,
    longitude: 103.835547,
    standType: "Stand",
    isBarrierFree: true,
  },
];
const ok = () =>
  Promise.resolve(
    new Response(JSON.stringify({ asOf: "2026-10-27T00:00:00.000Z", etag: '"v1"', data: stands }), { status: 200 }),
  );
const unavailable = () => Promise.resolve(new Response("{}", { status: 503 }));
const offline = () => Promise.reject(new TypeError("Failed to fetch"));

function memoryStore(initial: Record<string, unknown> = {}) {
  const data = new Map<string, unknown>(Object.entries(initial));
  return { data, read: async (k: string) => data.get(k), write: async (k: string, v: unknown) => void data.set(k, v) };
}

/** Wires the real controllers together the way startup.ts does, with a fake server and in-memory storage. */
function setUp(answer: () => Promise<Response> = ok, store = memoryStore()) {
  const fetchFn = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>(answer);
  const repo = new MapDataRepository();
  const settings = new SettingsController(store);
  const dataSync = new DataSyncController(new DataApiClient({ fetchFn }), repo, new CacheManager(store));
  const mapDisplay = new MapDisplayController(settings, dataSync, repo);
  dataSync.attach(mapDisplay);
  return { fetchFn, settings, dataSync, mapDisplay };
}

describe("MapDisplayController", () => {
  it("starts with nothing on the map and no notice", () => {
    const { mapDisplay } = setUp();
    expect(mapDisplay.getSnapshot()).toEqual({ visible: { TAXI_STAND: [] }, notice: null });
  });

  it("toggleLayer turns Taxi stands on in the settings and shows the stands once loaded", async () => {
    const { settings, mapDisplay } = setUp();

    await mapDisplay.toggleLayer("TAXI_STAND");

    expect(settings.isLayerVisible("TAXI_STAND")).toBe(true);
    expect(mapDisplay.getSnapshot().visible.TAXI_STAND.map((s) => s.id)).toEqual(["A01", "A05"]);
  });

  it("toggleLayer again turns them off and clears them from the map", async () => {
    const { settings, mapDisplay } = setUp();

    await mapDisplay.toggleLayer("TAXI_STAND");
    await mapDisplay.toggleLayer("TAXI_STAND");

    expect(settings.isLayerVisible("TAXI_STAND")).toBe(false);
    expect(mapDisplay.getSnapshot().visible.TAXI_STAND).toEqual([]);
  });

  it("on a load failure, switches the layer back off and sets a notice (UC 0001 exception 4a)", async () => {
    const { settings, mapDisplay } = setUp(unavailable);

    await mapDisplay.toggleLayer("TAXI_STAND");

    expect(settings.isLayerVisible("TAXI_STAND")).toBe(false);
    expect(mapDisplay.getSnapshot().notice).toMatch(/unable to load taxi stand markers/i);
    expect(mapDisplay.getSnapshot().visible.TAXI_STAND).toEqual([]);
  });

  it("dismissNotice clears the notice", async () => {
    const { mapDisplay } = setUp(unavailable);
    await mapDisplay.toggleLayer("TAXI_STAND");

    mapDisplay.dismissNotice();

    expect(mapDisplay.getSnapshot().notice).toBeNull();
  });

  it("toggling a layer that has no data yet only changes the setting — nothing is downloaded", async () => {
    const { fetchFn, settings, mapDisplay } = setUp();

    await mapDisplay.toggleLayer("FUEL");

    expect(settings.isLayerVisible("FUEL")).toBe(true);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("start() loads and shows Taxi stands if a previous session left them on", async () => {
    const { settings, mapDisplay } = setUp(ok, memoryStore({ preferences: { visibleLayers: ["TAXI_STAND"] } }));

    await settings.load();
    await mapDisplay.start();

    expect(mapDisplay.getSnapshot().visible.TAXI_STAND).toHaveLength(2);
  });

  it("start() does nothing if Taxi stands were left off", async () => {
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
    const first = setUp(ok, store);
    await first.mapDisplay.toggleLayer("TAXI_STAND"); // on: downloads and saves them
    await first.mapDisplay.toggleLayer("TAXI_STAND"); // off again

    const { settings, dataSync, mapDisplay } = setUp(offline, store);
    await settings.load();
    await dataSync.loadCached();
    await mapDisplay.start();
    await mapDisplay.toggleLayer("TAXI_STAND");

    expect(settings.isLayerVisible("TAXI_STAND")).toBe(true);
    expect(mapDisplay.getSnapshot().visible.TAXI_STAND.map((s) => s.id)).toEqual(["A01", "A05"]);
    expect(mapDisplay.getSnapshot().notice).toBeNull();
  });
});
