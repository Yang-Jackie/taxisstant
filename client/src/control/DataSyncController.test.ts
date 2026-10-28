// M6 acceptance tests — DataSyncController «control»: loads server data into MapDataRepository and tells
// its observers (DataSyncObserver) which layer changed. A fake fetch stands in for the server.
// M7 adds the cache: loadCached() at startup, a daily ETag re-check, and the saved copy when offline (D1).
// Package 2b: every static layer (D18). refreshLayer(t) is one layer, as a toggle needs it; refreshStatic() is all of them.
import { afterEach, describe, expect, it, vi } from "vitest";
import { Carpark } from "../entity/Carpark";
import { ChargingStation } from "../entity/ChargingStation";
import { FuelStation } from "../entity/FuelStation";
import { HawkerCentre } from "../entity/HawkerCentre";
import { STATIC_LAYERS } from "../entity/LayerType";
import { MapDataRepository } from "../entity/MapDataRepository";
import { Taxi } from "../entity/Taxi";
import { TaxiStand } from "../entity/TaxiStand";
import { CacheManager } from "../services/CacheManager";
import { DataApiClient } from "../services/DataApiClient";
import { CARPARKS, callsTo, fakeServer, offline, ok, status, STANDS, type Answer } from "../testing/fakeServer";
import { DataSyncController } from "./DataSyncController";

const DAY = 24 * 60 * 60 * 1000;

function memoryStore() {
  const data = new Map<string, unknown>();
  return { read: async (k: string) => data.get(k), write: async (k: string, v: unknown) => void data.set(k, v) };
}

/** One phone over time: the same storage and clock, and a fresh DataSyncController each time the app opens. */
function phone() {
  const store = memoryStore();
  let now = 0;
  return {
    later(ms: number) {
      now += ms;
    },
    open(answers: Record<string, Answer> = {}) {
      const fetchFn = fakeServer(answers);
      const repo = new MapDataRepository();
      const dataSync = new DataSyncController(new DataApiClient({ fetchFn }), repo, new CacheManager(store, () => now));
      const observer = { onDataUpdated: vi.fn() };
      dataSync.attach(observer);
      return { fetchFn, repo, dataSync, observer };
    },
  };
}

const setUp = (answers?: Record<string, Answer>) => phone().open(answers);
const shownIds = (repo: MapDataRepository) => repo.getByLayerType("TAXI_STAND").map((s) => s.id);
const sentEtag = (fetchFn: ReturnType<typeof fakeServer>) =>
  new Headers(fetchFn.mock.calls[0]![1]?.headers).get("If-None-Match");

describe("DataSyncController.refreshLayer — one layer, as a toggle needs it", () => {
  it("loads the taxi stands from /api/taxi-stands into the repository, as real TaxiStand objects", async () => {
    const { fetchFn, repo, dataSync } = setUp();

    await dataSync.refreshLayer("TAXI_STAND");

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(callsTo(fetchFn, "/taxi-stands")).toBe(1);
    expect(shownIds(repo)).toEqual(["A01", "A05", "A06"]);
    expect(repo.getByLayerType("TAXI_STAND")[0]).toBeInstanceOf(TaxiStand);
  });

  it("tells every attached observer which layer changed", async () => {
    const { dataSync, observer } = setUp();
    const second = { onDataUpdated: vi.fn() };
    dataSync.attach(second);

    await dataSync.refreshLayer("TAXI_STAND");

    expect(observer.onDataUpdated).toHaveBeenCalledWith("TAXI_STAND");
    expect(second.onDataUpdated).toHaveBeenCalledWith("TAXI_STAND");
  });

  it("downloads a layer only once per session", async () => {
    const { fetchFn, dataSync } = setUp();
    await dataSync.refreshLayer("TAXI_STAND");
    await dataSync.refreshLayer("TAXI_STAND");
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("shares one request between calls made at the same time (e.g. a quick double tap)", async () => {
    const { fetchFn, dataSync } = setUp();
    await Promise.all([dataSync.refreshLayer("TAXI_STAND"), dataSync.refreshLayer("TAXI_STAND")]);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("rejects when loading fails and nothing was ever saved; stores nothing and notifies no one", async () => {
    const { repo, dataSync, observer } = setUp({ "/taxi-stands": status(503) });

    await expect(dataSync.refreshLayer("TAXI_STAND")).rejects.toThrow(/503/);

    expect(repo.getByLayerType("TAXI_STAND")).toEqual([]);
    expect(observer.onDataUpdated).not.toHaveBeenCalled();
  });

  it("tries again on the next call after a failure", async () => {
    let attempt = 0;
    const { fetchFn, repo, dataSync } = setUp({
      "/taxi-stands": (init) => (++attempt === 1 ? status(503)(init) : ok(STANDS)(init)),
    });

    await expect(dataSync.refreshLayer("TAXI_STAND")).rejects.toThrow();
    await dataSync.refreshLayer("TAXI_STAND");

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(shownIds(repo)).toHaveLength(3);
  });
});

describe("DataSyncController.loadCached (M7)", () => {
  it("does nothing on a phone that has never downloaded anything", async () => {
    const { fetchFn, repo, dataSync, observer } = setUp();

    await dataSync.loadCached();

    expect(repo.getByLayerType("TAXI_STAND")).toEqual([]);
    expect(observer.onDataUpdated).not.toHaveBeenCalled();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("shows what an earlier session downloaded, as real TaxiStands, without using the network", async () => {
    const p = phone();
    await p.open().dataSync.refreshLayer("TAXI_STAND");

    const next = p.open({ "*": offline });
    await next.dataSync.loadCached();

    expect(shownIds(next.repo)).toEqual(["A01", "A05", "A06"]);
    expect(next.repo.getByLayerType("TAXI_STAND")[0]).toBeInstanceOf(TaxiStand);
    expect(next.observer.onDataUpdated).toHaveBeenCalledWith("TAXI_STAND");
    expect(next.fetchFn).not.toHaveBeenCalled();
  });

  it("fills every static layer an earlier session saved (package 2b)", async () => {
    const p = phone();
    await p.open().dataSync.refreshStatic();

    const next = p.open({ "*": offline });
    await next.dataSync.loadCached();

    for (const t of STATIC_LAYERS) expect(next.repo.getByLayerType(t), t).not.toHaveLength(0);
    expect(next.observer.onDataUpdated).toHaveBeenCalledTimes(STATIC_LAYERS.length);
  });
});

describe("DataSyncController.refreshLayer with a saved copy (M7, D1)", () => {
  it("doesn't contact the server again within a day of the last check", async () => {
    const p = phone();
    await p.open().dataSync.refreshLayer("TAXI_STAND");
    p.later(DAY - 1);

    const next = p.open();
    await next.dataSync.refreshLayer("TAXI_STAND");

    expect(next.fetchFn).not.toHaveBeenCalled();
  });

  it("re-checks once a day has passed, sending the saved ETag (If-None-Match)", async () => {
    const p = phone();
    await p.open().dataSync.refreshLayer("TAXI_STAND");
    p.later(DAY);

    const next = p.open({ "*": status(304) });
    await next.dataSync.refreshLayer("TAXI_STAND");

    expect(next.fetchFn).toHaveBeenCalledTimes(1);
    expect(sentEtag(next.fetchFn)).toBe('"v1"');
  });

  it("on 304 Not Modified, keeps the saved copy and counts as checked for another day", async () => {
    const p = phone();
    await p.open().dataSync.refreshLayer("TAXI_STAND");
    p.later(DAY);
    await p.open({ "*": status(304) }).dataSync.refreshLayer("TAXI_STAND");
    p.later(DAY - 1);

    const next = p.open();
    await next.dataSync.loadCached();
    await next.dataSync.refreshLayer("TAXI_STAND");

    expect(next.fetchFn).not.toHaveBeenCalled(); // the 304 a day ago counts as a check
    expect(shownIds(next.repo)).toEqual(["A01", "A05", "A06"]);
  });

  it("when the re-check brings new data, saves it and shows it", async () => {
    const p = phone();
    await p.open().dataSync.refreshLayer("TAXI_STAND");
    p.later(DAY);
    const withNew = [...STANDS, { ...STANDS[0]!, id: "B07", name: "New stand" }];

    const next = p.open({ "/taxi-stands": ok(withNew, '"v2"') });
    await next.dataSync.loadCached();
    next.observer.onDataUpdated.mockClear();
    await next.dataSync.refreshLayer("TAXI_STAND");

    expect(shownIds(next.repo)).toEqual(["A01", "A05", "A06", "B07"]);
    expect(next.observer.onDataUpdated).toHaveBeenCalledWith("TAXI_STAND");
    const afterThat = p.open({ "*": offline });
    await afterThat.dataSync.loadCached();
    expect(shownIds(afterThat.repo)).toEqual(["A01", "A05", "A06", "B07"]);
  });

  it("when the re-check fails, resolves without an error and keeps showing the saved copy", async () => {
    const p = phone();
    await p.open().dataSync.refreshLayer("TAXI_STAND");
    p.later(DAY);

    const next = p.open({ "*": offline });
    await next.dataSync.loadCached();
    await expect(next.dataSync.refreshLayer("TAXI_STAND")).resolves.toBeUndefined();

    expect(next.fetchFn).toHaveBeenCalledTimes(1);
    expect(shownIds(next.repo)).toEqual(["A01", "A05", "A06"]);
  });
});

describe("DataSyncController.refreshStatic — every static layer at once (package 2b, D18)", () => {
  it("downloads each static layer once, as real entities of its own type", async () => {
    const { fetchFn, repo, dataSync } = setUp();

    await dataSync.refreshStatic();

    for (const path of ["/taxi-stands", "/carparks", "/fuel-stations", "/charging-stations", "/hawker-centres"]) {
      expect(callsTo(fetchFn, path), path).toBe(1);
    }
    expect(repo.getByLayerType("TAXI_STAND")[0]).toBeInstanceOf(TaxiStand);
    expect(repo.getByLayerType("CARPARK")[0]).toBeInstanceOf(Carpark);
    expect(repo.getByLayerType("FUEL")[0]).toBeInstanceOf(FuelStation);
    expect(repo.getByLayerType("CHARGING")[0]).toBeInstanceOf(ChargingStation);
    expect(repo.getByLayerType("HAWKER")[0]).toBeInstanceOf(HawkerCentre);
  });

  it("tells observers about each layer separately", async () => {
    const { dataSync, observer } = setUp();
    await dataSync.refreshStatic();
    for (const t of STATIC_LAYERS) expect(observer.onDataUpdated).toHaveBeenCalledWith(t);
  });

  it("never rejects: a layer that fails doesn't stop the others", async () => {
    const { repo, dataSync } = setUp({ "/fuel-stations": status(503) });

    await expect(dataSync.refreshStatic()).resolves.toBeUndefined();

    expect(repo.getByLayerType("FUEL")).toEqual([]);
    expect(repo.getByLayerType("CARPARK")).not.toHaveLength(0);
  });

  it("leaves a failed layer to be tried again when it is toggled on", async () => {
    let attempt = 0;
    const { fetchFn, repo, dataSync } = setUp({
      "/fuel-stations": (init) => (++attempt === 1 ? offline(init) : ok([{ ...fuelStation() }])(init)),
    });

    await dataSync.refreshStatic();
    await dataSync.refreshLayer("FUEL");

    expect(callsTo(fetchFn, "/fuel-stations")).toBe(2);
    expect(repo.getByLayerType("FUEL")).toHaveLength(1);
  });

  it("is shared with a toggle that comes while it is still downloading: one request per endpoint", async () => {
    const { fetchFn, dataSync } = setUp();

    await Promise.all([dataSync.refreshStatic(), dataSync.refreshLayer("CHARGING")]);

    expect(callsTo(fetchFn, "/charging-stations")).toBe(1);
  });

  it("checks each downloaded layer against its own schema: a broken one is treated as a failure", async () => {
    const { repo, dataSync } = setUp({ "/carparks": ok([{ id: "1", name: "Suntec City" }]) }); // no coordinates
    await expect(dataSync.refreshLayer("CARPARK")).rejects.toThrow(/breaks the contract/);
    expect(repo.getByLayerType("CARPARK")).toEqual([]);
  });
});

function fuelStation() {
  return { id: "node/1", name: "Esso Test", brand: "Esso", latitude: 1.3, longitude: 103.8 };
}

// Package 2d — live data (D22, D25): refreshLive(layers) asks for what is on, together; refreshLiveLayer(t) for a toggle.
describe("DataSyncController — live layers (package 2d)", () => {
  afterEach(() => vi.useRealTimers());

  it("refreshLive asks only for the live data of the layers given, all at once", async () => {
    const { fetchFn, dataSync } = setUp();

    await dataSync.refreshLive(new Set(["TAXIS", "CARPARK", "FUEL"]));

    expect(callsTo(fetchFn, "/taxis")).toBe(1);
    expect(callsTo(fetchFn, "/carparks/availability")).toBe(1); // a carpark layer's live part
    expect(callsTo(fetchFn, "/hotspots")).toBe(0);
    expect(callsTo(fetchFn, "/charging-stations/availability")).toBe(0);
    expect(fetchFn).toHaveBeenCalledTimes(2); // fuel has no live data; nothing static is fetched
  });

  it("puts taxis in the repository as real Taxis, seen at the server's asOf, and tells observers", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-28T13:00:00Z"));
    const { repo, dataSync, observer } = setUp();

    await dataSync.refreshLive(new Set(["TAXIS"]));

    const taxis = repo.getByLayerType("TAXIS");
    expect(taxis).toHaveLength(4);
    expect(taxis[0]).toBeInstanceOf(Taxi);
    expect(taxis[0]!.seenAt.toISOString()).toBe("2026-10-28T13:00:00.000Z");
    expect(observer.onDataUpdated).toHaveBeenCalledWith("TAXIS");
  });

  it("keeps only busy stations as hotspots (D23)", async () => {
    const { repo, dataSync } = setUp();
    await dataSync.refreshLive(new Set(["HOTSPOT"]));
    expect(repo.getByLayerType("HOTSPOT").map((h) => [h.id, h.density])).toEqual([
      ["city-hall", "HIGH"],
      ["dhoby-ghaut", "MEDIUM"],
    ]);
  });

  it("puts free lots and chargers onto the carparks and charging stations", async () => {
    const { repo, dataSync, observer } = setUp();
    await dataSync.refreshStatic();

    await dataSync.refreshLive(new Set(["CARPARK", "CHARGING"]));

    expect(repo.getByLayerType("CARPARK").map((c) => [c.id, c.availableLots])).toEqual([
      ["1", 117],
      ["A2", 3],
    ]);
    expect(repo.getByLayerType("CHARGING")[0]!.availablePoints).toBe(2);
    expect(observer.onDataUpdated).toHaveBeenCalledWith("CARPARK");
  });

  it("keeps availability that arrived before its layer: the carpark list gets it when it lands", async () => {
    let release = () => {};
    const slowList = new Promise<void>((resolve) => (release = resolve));
    const { repo, dataSync } = setUp({ "/carparks": async (init) => (await slowList, ok(CARPARKS)(init)) });

    const list = dataSync.refreshLayer("CARPARK");
    await dataSync.refreshLive(new Set(["CARPARK"])); // availability first, as can happen at startup
    release();
    await list;

    expect(repo.getByLayerType("CARPARK").map((c) => c.availableLots)).toEqual([117, 3]);
  });

  it("refreshLive never rejects, even with the server down", async () => {
    const { dataSync } = setUp({ "*": offline });
    await expect(dataSync.refreshLive(new Set(["TAXIS", "HOTSPOT", "CARPARK"]))).resolves.toBeUndefined();
  });

  it("refreshLiveLayer rejects when nothing was ever saved and the download fails (exception 4a)", async () => {
    const { dataSync } = setUp({ "*": status(503) });
    await expect(dataSync.refreshLiveLayer("TAXIS")).rejects.toThrow(/503/);
  });

  it("refreshLiveLayer accepts a saved copy while it is recent enough, and not after (D22)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-28T13:00:00Z"));
    const p = phone();
    await p.open().dataSync.refreshLiveLayer("TAXIS");

    vi.setSystemTime(new Date("2026-10-28T13:04:00Z"));
    await expect(p.open({ "*": offline }).dataSync.refreshLiveLayer("TAXIS")).resolves.toBeUndefined();

    vi.setSystemTime(new Date("2026-10-28T13:06:00Z"));
    await expect(p.open({ "*": offline }).dataSync.refreshLiveLayer("TAXIS")).rejects.toThrow();
  });

  it("counts a 304 as confirmed now: the server says its latest data is the copy we have", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-28T13:00:00Z"));
    const p = phone();
    await p.open().dataSync.refreshLiveLayer("TAXIS");

    vi.setSystemTime(new Date("2026-10-28T13:06:00Z"));
    const next = p.open({ "/taxis": status(304) });
    await next.dataSync.refreshLiveLayer("TAXIS");

    expect(next.repo.getByLayerType("TAXIS")[0]!.seenAt.toISOString()).toBe("2026-10-28T13:06:00.000Z");
  });

  it("shares one request between a poll and a toggle that arrive together", async () => {
    const { fetchFn, dataSync } = setUp();
    await Promise.all([dataSync.refreshLive(new Set(["TAXIS"])), dataSync.refreshLiveLayer("TAXIS")]);
    expect(callsTo(fetchFn, "/taxis")).toBe(1);
  });

  it("asks again on the next poll: live data is never 'done for the session'", async () => {
    const { fetchFn, dataSync } = setUp();
    await dataSync.refreshLive(new Set(["TAXIS"]));
    await dataSync.refreshLive(new Set(["TAXIS"]));
    expect(callsTo(fetchFn, "/taxis")).toBe(2);
  });

  it("loadCached brings back saved live data too", async () => {
    const p = phone();
    await p.open().dataSync.refreshLive(new Set(["TAXIS"]));
    const next = p.open({ "*": offline });
    await next.dataSync.loadCached();
    expect(next.repo.getByLayerType("TAXIS")).toHaveLength(4);
  });
});
