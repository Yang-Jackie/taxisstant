// M6 acceptance tests — DataSyncController «control»: loads server data into MapDataRepository and tells
// its observers (DataSyncObserver) which layer changed. A fake fetch stands in for the server.
import { describe, expect, it, vi } from "vitest";
import { MapDataRepository } from "../entity/MapDataRepository";
import { TaxiStand } from "../entity/TaxiStand";
import { DataApiClient } from "../services/DataApiClient";
import { DataSyncController } from "./DataSyncController";

const stands = [
  { id: "A01", name: "Lucky Plaza", latitude: 1.304294727, longitude: 103.8338467, standType: "Stand", isBarrierFree: true },
  { id: "A05", name: "Mt Elizabeth", latitude: 1.304571786, longitude: 103.835547, standType: "Stand", isBarrierFree: true },
];
const okBody = { asOf: "2026-10-27T00:00:00.000Z", etag: '"v1"', data: stands };

function setUp(answer: () => Promise<Response> = async () => new Response(JSON.stringify(okBody), { status: 200 })) {
  const fetchFn = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>(answer);
  const repo = new MapDataRepository();
  const dataSync = new DataSyncController(new DataApiClient({ fetchFn }), repo);
  return { fetchFn, repo, dataSync };
}

describe("DataSyncController.refreshStatic", () => {
  it("loads the taxi stands from /api/taxi-stands into the repository, as real TaxiStand objects", async () => {
    const { fetchFn, repo, dataSync } = setUp();

    await dataSync.refreshStatic();

    expect(String(fetchFn.mock.calls[0]![0])).toBe("/api/taxi-stands");
    const loaded = repo.getByLayerType("TAXI_STAND");
    expect(loaded.map((s) => s.id)).toEqual(["A01", "A05"]);
    expect(loaded[0]).toBeInstanceOf(TaxiStand);
  });

  it("tells every attached observer which layer changed", async () => {
    const { dataSync } = setUp();
    const first = { onDataUpdated: vi.fn() };
    const second = { onDataUpdated: vi.fn() };
    dataSync.attach(first);
    dataSync.attach(second);

    await dataSync.refreshStatic();

    expect(first.onDataUpdated).toHaveBeenCalledWith("TAXI_STAND");
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

  it("rejects when loading fails, stores nothing and notifies no one", async () => {
    const { repo, dataSync } = setUp(async () => new Response("{}", { status: 503 }));
    const observer = { onDataUpdated: vi.fn() };
    dataSync.attach(observer);

    await expect(dataSync.refreshStatic()).rejects.toThrow(/503/);

    expect(repo.getByLayerType("TAXI_STAND")).toEqual([]);
    expect(observer.onDataUpdated).not.toHaveBeenCalled();
  });

  it("tries again on the next call after a failure", async () => {
    let attempt = 0;
    const { fetchFn, repo, dataSync } = setUp(async () => {
      attempt += 1;
      return attempt === 1 ? new Response("{}", { status: 503 }) : new Response(JSON.stringify(okBody), { status: 200 });
    });

    await expect(dataSync.refreshStatic()).rejects.toThrow();
    await dataSync.refreshStatic();

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(repo.getByLayerType("TAXI_STAND")).toHaveLength(2);
  });
});
