// M6 acceptance tests — DataSyncController «control»: loads server data into MapDataRepository and tells
// its observers (DataSyncObserver) which layer changed. A fake fetch stands in for the server.
// M7 adds the cache: loadCached() at startup, a daily ETag re-check, and the saved copy when offline (D1).
import { describe, expect, it, vi } from "vitest";
import { MapDataRepository } from "../entity/MapDataRepository";
import { TaxiStand } from "../entity/TaxiStand";
import { CacheManager } from "../services/CacheManager";
import { DataApiClient } from "../services/DataApiClient";
import { DataSyncController } from "./DataSyncController";

const DAY = 24 * 60 * 60 * 1000;
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
const okBody = { asOf: "2026-10-27T00:00:00.000Z", etag: '"v1"', data: stands };

type Answer = () => Promise<Response>;
const serving: Answer = async () => new Response(JSON.stringify(okBody), { status: 200 });
const notModified: Answer = async () => new Response(null, { status: 304 });
const offline: Answer = () => Promise.reject(new TypeError("Failed to fetch"));

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
    open(answer: Answer = serving) {
      const fetchFn = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>(answer);
      const repo = new MapDataRepository();
      const dataSync = new DataSyncController(new DataApiClient({ fetchFn }), repo, new CacheManager(store, () => now));
      const observer = { onDataUpdated: vi.fn() };
      dataSync.attach(observer);
      return { fetchFn, repo, dataSync, observer };
    },
  };
}

const setUp = (answer?: Answer) => phone().open(answer);
const shownIds = (repo: MapDataRepository) => repo.getByLayerType("TAXI_STAND").map((s) => s.id);
const sentEtag = (fetchFn: ReturnType<typeof setUp>["fetchFn"]) =>
  new Headers(fetchFn.mock.calls[0]![1]?.headers).get("If-None-Match");

describe("DataSyncController.refreshStatic", () => {
  it("loads the taxi stands from /api/taxi-stands into the repository, as real TaxiStand objects", async () => {
    const { fetchFn, repo, dataSync } = setUp();

    await dataSync.refreshStatic();

    expect(String(fetchFn.mock.calls[0]![0])).toBe("/api/taxi-stands");
    expect(shownIds(repo)).toEqual(["A01", "A05"]);
    expect(repo.getByLayerType("TAXI_STAND")[0]).toBeInstanceOf(TaxiStand);
  });

  it("tells every attached observer which layer changed", async () => {
    const { dataSync, observer } = setUp();
    const second = { onDataUpdated: vi.fn() };
    dataSync.attach(second);

    await dataSync.refreshStatic();

    expect(observer.onDataUpdated).toHaveBeenCalledWith("TAXI_STAND");
    expect(second.onDataUpdated).toHaveBeenCalledWith("TAXI_STAND");
  });

  it("downloads static data only once per session", async () => {
    const { fetchFn, dataSync } = setUp();
    await dataSync.refreshStatic();
    await dataSync.refreshStatic();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("shares one request between calls made at the same time (e.g. a quick double tap)", async () => {
    const { fetchFn, dataSync } = setUp();
    await Promise.all([dataSync.refreshStatic(), dataSync.refreshStatic()]);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("rejects when loading fails and nothing was ever saved; stores nothing and notifies no one", async () => {
    const { repo, dataSync, observer } = setUp(async () => new Response("{}", { status: 503 }));

    await expect(dataSync.refreshStatic()).rejects.toThrow(/503/);

    expect(repo.getByLayerType("TAXI_STAND")).toEqual([]);
    expect(observer.onDataUpdated).not.toHaveBeenCalled();
  });

  it("tries again on the next call after a failure", async () => {
    let attempt = 0;
    const { fetchFn, repo, dataSync } = setUp(async () => {
      attempt += 1;
      return attempt === 1
        ? new Response("{}", { status: 503 })
        : new Response(JSON.stringify(okBody), { status: 200 });
    });

    await expect(dataSync.refreshStatic()).rejects.toThrow();
    await dataSync.refreshStatic();

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(shownIds(repo)).toHaveLength(2);
  });
});

describe("DataSyncController.loadCached (M7)", () => {
  it("does nothing on a phone that has never downloaded the stands", async () => {
    const { fetchFn, repo, dataSync, observer } = setUp();

    await dataSync.loadCached();

    expect(repo.getByLayerType("TAXI_STAND")).toEqual([]);
    expect(observer.onDataUpdated).not.toHaveBeenCalled();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("shows what an earlier session downloaded, as real TaxiStands, without using the network", async () => {
    const p = phone();
    await p.open().dataSync.refreshStatic();

    const next = p.open(offline);
    await next.dataSync.loadCached();

    expect(shownIds(next.repo)).toEqual(["A01", "A05"]);
    expect(next.repo.getByLayerType("TAXI_STAND")[0]).toBeInstanceOf(TaxiStand);
    expect(next.observer.onDataUpdated).toHaveBeenCalledWith("TAXI_STAND");
    expect(next.fetchFn).not.toHaveBeenCalled();
  });
});

describe("DataSyncController.refreshStatic with a saved copy (M7, D1)", () => {
  it("doesn't contact the server again within a day of the last check", async () => {
    const p = phone();
    await p.open().dataSync.refreshStatic();
    p.later(DAY - 1);

    const next = p.open();
    await next.dataSync.refreshStatic();

    expect(next.fetchFn).not.toHaveBeenCalled();
  });

  it("re-checks once a day has passed, sending the saved ETag (If-None-Match)", async () => {
    const p = phone();
    await p.open().dataSync.refreshStatic();
    p.later(DAY);

    const next = p.open(notModified);
    await next.dataSync.refreshStatic();

    expect(next.fetchFn).toHaveBeenCalledTimes(1);
    expect(sentEtag(next.fetchFn)).toBe('"v1"');
  });

  it("on 304 Not Modified, keeps the saved copy and counts as checked for another day", async () => {
    const p = phone();
    await p.open().dataSync.refreshStatic();
    p.later(DAY);
    await p.open(notModified).dataSync.refreshStatic();
    p.later(DAY - 1);

    const next = p.open();
    await next.dataSync.loadCached();
    await next.dataSync.refreshStatic();

    expect(next.fetchFn).not.toHaveBeenCalled(); // the 304 a day ago counts as a check
    expect(shownIds(next.repo)).toEqual(["A01", "A05"]);
  });

  it("when the re-check brings new data, saves it and shows it", async () => {
    const p = phone();
    await p.open().dataSync.refreshStatic();
    p.later(DAY);
    const newStand = { ...stands[0]!, id: "B07", name: "New stand" };
    const v2 = { asOf: "2026-10-28T00:00:00.000Z", etag: '"v2"', data: [...stands, newStand] };

    const next = p.open(async () => new Response(JSON.stringify(v2), { status: 200 }));
    await next.dataSync.loadCached();
    next.observer.onDataUpdated.mockClear();
    await next.dataSync.refreshStatic();

    expect(shownIds(next.repo)).toEqual(["A01", "A05", "B07"]);
    expect(next.observer.onDataUpdated).toHaveBeenCalledWith("TAXI_STAND");
    const afterThat = p.open(offline);
    await afterThat.dataSync.loadCached();
    expect(shownIds(afterThat.repo)).toEqual(["A01", "A05", "B07"]);
  });

  it("when the re-check fails, resolves without an error and keeps showing the saved copy", async () => {
    const p = phone();
    await p.open().dataSync.refreshStatic();
    p.later(DAY);

    const next = p.open(offline);
    await next.dataSync.loadCached();
    await expect(next.dataSync.refreshStatic()).resolves.toBeUndefined();

    expect(next.fetchFn).toHaveBeenCalledTimes(1);
    expect(shownIds(next.repo)).toEqual(["A01", "A05"]);
  });
});
