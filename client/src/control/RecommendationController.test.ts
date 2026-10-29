// Package 7 acceptance tests — RecommendationController «control»: smart suggestions (UC 0008 rest stop, UC 0009
// pickup). The server scores the sites; rank() picks the best 3 near the driver (D34). A toggle turns a suggestion
// on with its related layers and off with the ones it turned on (D35); exceptions 2a and 4a give their toasts.
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Viewport } from "../entity/Bounds";
import { Location } from "../entity/Location";
import { MapDataRepository } from "../entity/MapDataRepository";
import type { RecommendationKind } from "../entity/RecommendationKind";
import { SuggestedPickup } from "../entity/SuggestedPickup";
import { SuggestedRestStop, type SuggestedRestStopProps } from "../entity/SuggestedRestStop";
import type { UserPreferences, VehicleType } from "../entity/UserPreferences";
import { CacheManager } from "../services/CacheManager";
import { DataApiClient } from "../services/DataApiClient";
import { callsTo, fakeServer, offline, ok, ORCHARD, PICKUPS, status, type Answer } from "../testing/fakeServer";
import { DataSyncController } from "./DataSyncController";
import { LIVE_POLL_MS, MapDisplayController, SINGAPORE_VIEW } from "./MapDisplayController";
import { rank, RecommendationController } from "./RecommendationController";
import { SettingsController } from "./SettingsController";

const NOW = new Date("2026-10-29T13:00:00Z");

// --- rank() on its own -------------------------------------------------------------------------------------------

const FROM = new Location(1.3, 103.8);
/** Degrees of latitude in a kilometre, as Location.distanceTo measures (R = 6371 km). */
const DEGREES_PER_KM = 180 / (Math.PI * 6371);
const northBy = (km: number) => new Location(1.3 + km * DEGREES_PER_KM, 103.8);

const pickupAt = (id: string, score: number, km: number) =>
  new SuggestedPickup({ id, name: id, centre: northBy(km), radius: 300, score, summary: "", asOf: NOW, taxiCount: 0 });
const restStopAt = (id: string, score: number, km: number, near: Partial<SuggestedRestStopProps> = {}) =>
  new SuggestedRestStop({
    id,
    name: id,
    centre: northBy(km),
    radius: 500,
    score,
    summary: "",
    asOf: NOW,
    foodStalls: 40,
    hasParking: true,
    hasFuel: false,
    hasCharging: false,
    ...near,
  });
const prefs = (vehicleType?: VehicleType): UserPreferences => ({
  visibleLayers: new Set(),
  activeSuggestions: new Set(),
  suggestionLayers: new Map(),
  ...(vehicleType && { vehicleType }),
});
const ranked = (sites: Parameters<typeof rank>[0], p = prefs()) => rank(sites, FROM, p).map((r) => r.site.id);

describe("rank (D34)", () => {
  it("keeps pickups within 3 km of the driver, and rest stops within 5 km", () => {
    expect(ranked([pickupAt("in", 0.5, 2.99), pickupAt("out", 0.9, 3.01)])).toEqual(["in"]);
    expect(ranked([restStopAt("in", 0.5, 4.99), restStopAt("out", 0.9, 5.01)])).toEqual(["in"]);
  });

  it("says how far each site is", () => {
    const [r] = rank([pickupAt("A", 0.5, 1.2)], FROM, prefs());
    expect(r!.distanceM).toBeCloseTo(1200, 6);
  });

  it("counts a site 1.5 km away half as much as one right here: neither score nor distance alone decides", () => {
    // Values: B 1.0 / (1 + 1.45/1.5) = 0.508, A 0.5, C 1.0 / (1 + 1.55/1.5) = 0.492
    const sites = [pickupAt("A", 0.5, 0), pickupAt("B", 1.0, 1.45), pickupAt("C", 1.0, 1.55)];
    expect(ranked(sites)).toEqual(["B", "A", "C"]);
  });

  it("suggests the best 3 at most", () => {
    const sites = [0.9, 0.8, 0.7, 0.6, 0.5].map((score) => pickupAt(String(score), score, 0.1));
    expect(ranked(sites)).toEqual(["0.9", "0.8", "0.7"]);
  });

  it("keeps the server's order for sites of equal value", () => {
    expect(ranked([pickupAt("first", 0.5, 1), pickupAt("second", 0.5, 1)])).toEqual(["first", "second"]);
  });

  // Values without the bonus: MORE 0.57, PLAIN 0.5, FUEL 0.45 (0.5625 with it), CHARGE 0.45, FULL 0.45 (no chargers free)
  const restStops = [
    restStopAt("MORE", 0.57, 0),
    restStopAt("PLAIN", 0.5, 0),
    restStopAt("FUEL", 0.45, 0, { hasFuel: true }),
    restStopAt("CHARGE", 0.45, 0, { hasCharging: true }),
    restStopAt("FULL", 0.45, 0, { hasCharging: true, freeChargePoints: 0 }),
  ];

  it("counts a rest stop with fuel 1.25 times for a driver who refuels", () => {
    expect(ranked(restStops, prefs("FUEL"))).toEqual(["MORE", "FUEL", "PLAIN"]);
  });

  it("counts a rest stop with chargers 1.25 times for an EV driver, unless they are known to be all taken", () => {
    expect(ranked(restStops, prefs("EV"))).toEqual(["MORE", "CHARGE", "PLAIN"]);
    expect(
      ranked(
        [restStopAt("PLAIN", 0.5, 0), restStopAt("FULL", 0.45, 0, { hasCharging: true, freeChargePoints: 0 })],
        prefs("EV"),
      ),
    ).toEqual(["PLAIN", "FULL"]);
  });

  it("counts no energy stop before the driver has said what they drive (package 9)", () => {
    expect(ranked(restStops)).toEqual(["MORE", "PLAIN", "FUEL"]);
  });
});

// --- The controller, wired to the real ones ---------------------------------------------------------------------

function memoryStore(initial: Record<string, unknown> = {}) {
  const data = new Map<string, unknown>(Object.entries(initial));
  return { data, read: async (k: string) => data.get(k), write: async (k: string, v: unknown) => void data.set(k, v) };
}

const STREET_LEVEL: Viewport = { bounds: SINGAPORE_VIEW.bounds, zoom: 18 };
const AT_ORCHARD = new Location(ORCHARD.latitude, ORCHARD.longitude);
const AT_JURONG_EAST = new Location(1.3331, 103.7422);
const AT_CHANGI = new Location(1.364, 103.991); // the airport: nothing in the fake data is within 5 km

/** Wires the controllers the way startup.ts does, with a fake server, in-memory storage and a driver to move by hand. */
function setUp(answers: Record<string, Answer> = {}, store = memoryStore()) {
  const fetchFn = fakeServer(answers);
  const repo = new MapDataRepository();
  const settings = new SettingsController(store);
  const dataSync = new DataSyncController(new DataApiClient({ fetchFn }), repo, new CacheManager(store));
  const mapDisplay = new MapDisplayController(settings, dataSync, repo);
  dataSync.attach(mapDisplay);
  mapDisplay.refreshVisible(STREET_LEVEL);
  const driver = { at: AT_ORCHARD as Location | undefined, getCurrentLocation: () => driver.at };
  const recommendations = new RecommendationController(settings, dataSync, repo, mapDisplay, driver);
  dataSync.attach(recommendations);
  return { fetchFn, store, settings, dataSync, mapDisplay, recommendations, driver };
}

const ids = (recommendations: RecommendationController, k: RecommendationKind) =>
  recommendations.getSnapshot().results[k].map((r) => r.site.id);
const visibleLayers = (settings: SettingsController) => [...settings.getPreferences().visibleLayers].sort();

afterEach(() => vi.useRealTimers());

describe("RecommendationController.toggle — on (UC 0008/0009)", () => {
  it("suggests the best pickups near the driver, nearest-weighted, and none beyond 3 km (UC 0009)", async () => {
    const { fetchFn, settings, recommendations } = setUp();

    await recommendations.toggle("PICKUP", true);

    expect(callsTo(fetchFn, "/pickup-sites")).toBe(1);
    expect(settings.isSuggestionActive("PICKUP")).toBe(true);
    expect(ids(recommendations, "PICKUP")).toEqual(["A05", "A01"]); // JE1 scores best but is 10.7 km away
    const [first] = recommendations.getSnapshot().results.PICKUP;
    expect(first!.distanceM).toBeGreaterThan(190);
    expect(first!.distanceM).toBeLessThan(205);
  });

  it("suggests the best rest stops near the driver (UC 0008)", async () => {
    const { recommendations } = setUp();
    await recommendations.toggle("REST_STOP", true);
    expect(ids(recommendations, "REST_STOP")).toEqual(["adam-road-food-centre", "maxwell-food-centre"]);
  });

  it("turns its related layers on and shows them (step 5): taxi stands, nearby taxis, hotspots", async () => {
    const { settings, mapDisplay, recommendations } = setUp();

    await recommendations.toggle("PICKUP", true);

    expect(visibleLayers(settings)).toEqual(["HOTSPOT", "TAXIS", "TAXI_STAND"]);
    expect(mapDisplay.getSnapshot().visible.TAXI_STAND.items.map((s) => s.id)).toEqual(["A01", "A05", "A06"]);
    expect(mapDisplay.getSnapshot().visible.TAXIS.items).toHaveLength(4);
  });

  it("turns on charging, fuel, carparks and hawker food with a rest stop (step 5)", async () => {
    const { settings, recommendations } = setUp();
    await recommendations.toggle("REST_STOP", true);
    expect(visibleLayers(settings)).toEqual(["CARPARK", "CHARGING", "FUEL", "HAWKER"]);
  });

  it("saves the toggle (step 7)", async () => {
    const { store, recommendations } = setUp();
    await recommendations.toggle("PICKUP", true);
    expect(store.data.get("preferences")).toMatchObject({ activeSuggestions: ["PICKUP"] });
  });

  it("shows that it is loading meanwhile, and a second tap shares the same request", async () => {
    let release = () => {};
    const slow = new Promise<void>((resolve) => (release = resolve));
    const { fetchFn, recommendations } = setUp({ "/pickup-sites": async (init) => (await slow, ok(PICKUPS)(init)) });

    const first = recommendations.toggle("PICKUP", true);
    await vi.waitFor(() => expect(recommendations.getSnapshot().pending.has("PICKUP")).toBe(true));
    const second = recommendations.toggle("PICKUP", true);
    release();
    await Promise.all([first, second]);

    expect(callsTo(fetchFn, "/pickup-sites")).toBe(1);
    expect(recommendations.getSnapshot().pending.size).toBe(0);
  });

  it("works offline with sites saved minutes ago (D1, D36)", async () => {
    const store = memoryStore();
    await setUp({}, store).dataSync.refreshSuggestions("PICKUP"); // an earlier session
    const { settings, dataSync, recommendations } = setUp({ "*": offline }, store);
    await dataSync.loadCached(); // as at startup

    await recommendations.toggle("PICKUP", true);

    expect(settings.isSuggestionActive("PICKUP")).toBe(true);
    expect(ids(recommendations, "PICKUP")).toEqual(["A05", "A01"]);
  });
});

describe("RecommendationController.toggle — exceptions", () => {
  const loadFailed: [RecommendationKind, string][] = [
    ["PICKUP", "Unable to load pickup markers. Please check your connection."],
    ["REST_STOP", "Unable to load rest stop markers. Please check your connection."],
  ];
  for (const [k, toast] of loadFailed) {
    it(`2a: with no ${k} sites to be had, gives its toast and stays off, with no layers turned on`, async () => {
      const { settings, mapDisplay, recommendations } = setUp({ "*": status(503) });

      await recommendations.toggle(k, true);

      expect(mapDisplay.getSnapshot().notice).toBe(toast);
      expect(settings.isSuggestionActive(k)).toBe(false);
      expect(visibleLayers(settings)).toEqual([]);
      expect(recommendations.getSnapshot().pending.size).toBe(0);
    });
  }

  it("4a: with no position to rank from, says it can't calculate and stays off", async () => {
    const { settings, mapDisplay, recommendations, driver } = setUp();
    driver.at = undefined;

    await recommendations.toggle("PICKUP", true);

    expect(mapDisplay.getSnapshot().notice).toBe(
      "Unable to calculate nearby pickup spots without your location. Please try again later.",
    );
    expect(settings.isSuggestionActive("PICKUP")).toBe(false);
    expect(visibleLayers(settings)).toEqual([]);
  });

  it("4a: with nothing near enough, says there are no ideal spots nearby and stays off", async () => {
    const { settings, mapDisplay, recommendations, driver } = setUp();
    driver.at = AT_CHANGI;

    await recommendations.toggle("REST_STOP", true);

    expect(mapDisplay.getSnapshot().notice).toBe("There are no ideal rest stops nearby. Please try again later.");
    expect(settings.isSuggestionActive("REST_STOP")).toBe(false);
    expect(visibleLayers(settings)).toEqual([]);
  });
});

describe("RecommendationController.toggle — off (D35)", () => {
  it("clears its sites, and turns off the layers it turned on", async () => {
    const { settings, recommendations } = setUp();
    await recommendations.toggle("PICKUP", true);

    await recommendations.toggle("PICKUP", false);

    expect(settings.isSuggestionActive("PICKUP")).toBe(false);
    expect(recommendations.getSnapshot().results.PICKUP).toEqual([]);
    expect(visibleLayers(settings)).toEqual([]);
  });

  it("clears its sites at once, without waiting for the settings to be saved", async () => {
    const store = memoryStore();
    const { recommendations } = setUp({}, store);
    await recommendations.toggle("PICKUP", true);
    store.write = () => new Promise<undefined>(() => {}); // a save that never finishes

    void recommendations.toggle("PICKUP", false);

    expect(recommendations.getSnapshot().results.PICKUP).toEqual([]);
  });

  it("leaves on the layers the driver already had on", async () => {
    const { settings, mapDisplay, recommendations } = setUp();
    await mapDisplay.toggleLayer("TAXI_STAND");
    await recommendations.toggle("PICKUP", true);

    await recommendations.toggle("PICKUP", false);

    expect(visibleLayers(settings)).toEqual(["TAXI_STAND"]);
  });

  it("leaves on a layer the driver toggled themselves while it was on", async () => {
    const { settings, mapDisplay, recommendations } = setUp();
    await recommendations.toggle("PICKUP", true);
    await mapDisplay.toggleLayer("HOTSPOT"); // off, then on again: the driver's own now
    await mapDisplay.toggleLayer("HOTSPOT");

    await recommendations.toggle("PICKUP", false);

    expect(visibleLayers(settings)).toEqual(["HOTSPOT"]);
  });

  it("leaves the other suggestion as it was", async () => {
    const { settings, recommendations } = setUp();
    await recommendations.toggle("PICKUP", true);
    await recommendations.toggle("REST_STOP", true);

    await recommendations.toggle("PICKUP", false);

    expect(ids(recommendations, "REST_STOP")).toHaveLength(2);
    expect(visibleLayers(settings)).toEqual(["CARPARK", "CHARGING", "FUEL", "HAWKER"]);
  });
});

describe("RecommendationController — keeping the ranking current", () => {
  it("ranks again from where the driver is now when they move", async () => {
    const { recommendations, driver } = setUp();
    await recommendations.toggle("PICKUP", true);

    driver.at = AT_JURONG_EAST;
    recommendations.onLocationUpdated();

    expect(ids(recommendations, "PICKUP")).toEqual(["JE1"]);
  });

  it("says why there is nothing to suggest after the driver moves away from every site", async () => {
    const { settings, recommendations, driver } = setUp();
    await recommendations.toggle("PICKUP", true);

    driver.at = AT_CHANGI;
    recommendations.onLocationUpdated();

    expect(ids(recommendations, "PICKUP")).toEqual([]);
    expect(recommendations.getSnapshot().noResults.PICKUP).toBe("NONE_NEARBY");
    expect(settings.isSuggestionActive("PICKUP")).toBe(true); // still on: a drive back brings them back
  });

  it("ranks again when new scores arrive", async () => {
    let scores = PICKUPS;
    const { dataSync, recommendations } = setUp({ "/pickup-sites": (init) => ok(scores, `"${scores.length}"`)(init) });
    await recommendations.toggle("PICKUP", true);

    scores = PICKUPS.map((p) => (p.id === "A01" ? { ...p, score: 0.95 } : p)); // Lucky Plaza gets busy
    await dataSync.refreshLive(new Set(), new Set(["PICKUP"]));

    expect(ids(recommendations, "PICKUP")).toEqual(["A01", "A05"]);
  });

  it("ignores new scores for a suggestion that is off", async () => {
    const { dataSync, recommendations } = setUp();
    await dataSync.refreshSuggestions("PICKUP");
    expect(recommendations.getSnapshot().results.PICKUP).toEqual([]);
  });

  it("takes pickups away once they are over 5 minutes old with nothing newer (D36)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    let online = true;
    const { recommendations } = setUp({ "/pickup-sites": (init) => (online ? ok(PICKUPS)(init) : offline(init)) });
    await recommendations.toggle("PICKUP", true);
    online = false;

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(ids(recommendations, "PICKUP")).toEqual(["A05", "A01"]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(ids(recommendations, "PICKUP")).toEqual([]);
    expect(recommendations.getSnapshot().noResults.PICKUP).toBe("OUT_OF_DATE");
  });

  it("is polled with the live layers every 30 s, even with its own layers turned off (D25)", async () => {
    vi.useFakeTimers();
    const { fetchFn, mapDisplay, recommendations } = setUp();
    await recommendations.toggle("PICKUP", true);
    for (const t of ["TAXI_STAND", "TAXIS", "HOTSPOT"] as const) await mapDisplay.toggleLayer(t);
    mapDisplay.setForeground(true);
    const before = callsTo(fetchFn, "/pickup-sites");

    await vi.advanceTimersByTimeAsync(LIVE_POLL_MS);

    expect(callsTo(fetchFn, "/pickup-sites")).toBe(before + 2); // once on coming to the front, once on the tick
    expect(callsTo(fetchFn, "/rest-stop-sites")).toBe(0); // only what is on
    mapDisplay.setForeground(false);
  });
});

describe("RecommendationController.start — suggestions left on by an earlier session", () => {
  const leftOn = () =>
    memoryStore({
      preferences: {
        visibleLayers: ["TAXI_STAND", "TAXIS", "HOTSPOT"],
        activeSuggestions: ["PICKUP"],
        suggestionLayers: { PICKUP: ["TAXIS", "HOTSPOT"] },
      },
    });

  it("ranks them again", async () => {
    const { settings, recommendations } = setUp({}, leftOn());
    await settings.load();

    await recommendations.start();

    expect(ids(recommendations, "PICKUP")).toEqual(["A05", "A01"]);
  });

  it("waits for a position, saying so, and ranks as soon as there is one", async () => {
    const { settings, recommendations, driver } = setUp({}, leftOn());
    driver.at = undefined;
    await settings.load();

    await recommendations.start();
    expect(recommendations.getSnapshot().noResults.PICKUP).toBe("NO_POSITION");
    expect(settings.isSuggestionActive("PICKUP")).toBe(true);

    driver.at = AT_ORCHARD;
    recommendations.onLocationUpdated();
    expect(ids(recommendations, "PICKUP")).toEqual(["A05", "A01"]);
    expect(recommendations.getSnapshot().noResults.PICKUP).toBeUndefined();
  });

  it("switches one off, with the layers it turned on, when its sites can't be loaded (2a)", async () => {
    const { settings, mapDisplay, recommendations } = setUp({ "/pickup-sites": status(503) }, leftOn());
    await settings.load();

    await recommendations.start();

    expect(settings.isSuggestionActive("PICKUP")).toBe(false);
    expect(visibleLayers(settings)).toEqual(["TAXI_STAND"]); // the driver's own
    expect(mapDisplay.getSnapshot().notice).toBe("Unable to load pickup markers. Please check your connection.");
  });
});
