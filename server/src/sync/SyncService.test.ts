// M3 acceptance tests — SyncService «control»: fetch → prepare → store, once at start-up and then on
// each adapter's own interval. Keeps the last good copy when anything fails (D7).
// Vitest's fake timers let these tests "wait" a whole day in milliseconds.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DatasetAdapter } from "./DatasetAdapter.js";
import { ServerDataCache } from "../cache/ServerDataCache.js";
import { SyncService } from "./SyncService.js";

const INTERVAL = 10_000;
const RETRY = 1_000;

/** A tiny adapter for tests: passes arrays through, rejects anything else. */
const adapter: DatasetAdapter<unknown[]> = {
  getDataset: () => "TAXI_STANDS",
  getSource: () => "LTA_DATAMALL",
  getPath: () => "/TaxiStands",
  getRefreshInterval: () => INTERVAL,
  prepare: (raw) => {
    if (!Array.isArray(raw)) throw new Error("not an array");
    return raw;
  },
};

/** A fake facade; only `fetch` is needed (see Pick<ExternalApiFacade, "fetch"> in SyncService). */
function fakeFacade() {
  return { fetch: vi.fn<(provider: string, path: string) => Promise<unknown>>() };
}

let cache: ServerDataCache;
let sync: SyncService | undefined;

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "error").mockImplementation(() => {}); // failures are logged; keep test output clean
  cache = new ServerDataCache();
});

afterEach(() => {
  sync?.stop();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("SyncService", () => {
  it("syncs each adapter once at start: fetch from its source and path, prepare, store", async () => {
    const facade = fakeFacade();
    facade.fetch.mockResolvedValue(["stand A"]);
    sync = new SyncService(facade, cache, [adapter], RETRY);

    await sync.start();

    expect(facade.fetch).toHaveBeenCalledWith("LTA_DATAMALL", "/TaxiStands");
    expect(cache.get("TAXI_STANDS")?.data).toEqual(["stand A"]);
  });

  it("refreshes after the adapter's interval, not before", async () => {
    const facade = fakeFacade();
    facade.fetch.mockResolvedValueOnce(["v1"]).mockResolvedValueOnce(["v2"]);
    sync = new SyncService(facade, cache, [adapter], RETRY);
    await sync.start();

    await vi.advanceTimersByTimeAsync(INTERVAL - 1);
    expect(facade.fetch).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(facade.fetch).toHaveBeenCalledTimes(2);
    expect(cache.get("TAXI_STANDS")?.data).toEqual(["v2"]);
  });

  it("still finishes start() when the first sync fails, so the server can start listening (503 until data)", async () => {
    const facade = fakeFacade();
    facade.fetch.mockRejectedValue(new Error("LTA is down"));
    sync = new SyncService(facade, cache, [adapter], RETRY);

    await expect(sync.start()).resolves.toBeUndefined();
    expect(cache.get("TAXI_STANDS")).toBeUndefined();
  });

  it("retries a failed sync after the retry delay, instead of waiting a whole interval", async () => {
    const facade = fakeFacade();
    facade.fetch.mockRejectedValueOnce(new Error("LTA is down")).mockResolvedValue(["stand A"]);
    sync = new SyncService(facade, cache, [adapter], RETRY);
    await sync.start();

    await vi.advanceTimersByTimeAsync(RETRY);
    expect(cache.get("TAXI_STANDS")?.data).toEqual(["stand A"]);
  });

  it("keeps the last good copy when a later fetch fails", async () => {
    const facade = fakeFacade();
    facade.fetch.mockResolvedValueOnce(["good"]).mockRejectedValueOnce(new Error("LTA is down"));
    sync = new SyncService(facade, cache, [adapter], RETRY);
    await sync.start();
    const before = cache.get("TAXI_STANDS");

    await vi.advanceTimersByTimeAsync(INTERVAL);
    expect(facade.fetch).toHaveBeenCalledTimes(2);
    expect(cache.get("TAXI_STANDS")).toEqual(before);
  });

  it("keeps the last good copy when new data fails validation", async () => {
    const facade = fakeFacade();
    facade.fetch.mockResolvedValueOnce(["good"]).mockResolvedValueOnce({ not: "an array" });
    sync = new SyncService(facade, cache, [adapter], RETRY);
    await sync.start();
    const before = cache.get("TAXI_STANDS");

    await vi.advanceTimersByTimeAsync(INTERVAL);
    expect(cache.get("TAXI_STANDS")).toEqual(before);
  });

  it("stops scheduling when stop() is called", async () => {
    const facade = fakeFacade();
    facade.fetch.mockResolvedValue(["stand A"]);
    sync = new SyncService(facade, cache, [adapter], RETRY);
    await sync.start();

    sync.stop();
    await vi.advanceTimersByTimeAsync(INTERVAL * 10);
    expect(facade.fetch).toHaveBeenCalledTimes(1);
  });
});
