// M3 acceptance tests — SyncService «control»: fetch → prepare → store, once at start-up and then on
// each adapter's own interval. Keeps the last good copy when anything fails (D7).
// Vitest's fake timers let these tests "wait" a whole day in milliseconds.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Dataset } from "../cache/Dataset.js";
import type { DatasetAdapter } from "./DatasetAdapter.js";
import type { SuggestionStrategy } from "./strategies/SuggestionStrategy.js";
import { ServerDataCache } from "../cache/ServerDataCache.js";
import { SyncService } from "./SyncService.js";

const INTERVAL = 10_000;
const RETRY = 1_000;

/** A tiny adapter for tests: passes arrays through, rejects anything else. */
const adapter: DatasetAdapter<unknown[]> = {
  getDataset: () => "TAXI_STANDS",
  getSource: () => "LTA_DATAMALL",
  getPaths: () => ["/TaxiStands"],
  getRefreshInterval: () => INTERVAL,
  prepare: ([raw]) => {
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

// Package 2c (D21) — an adapter that needs several requests, e.g. one per train line.
describe("SyncService with a several-path adapter", () => {
  const perLine: DatasetAdapter<string[]> = {
    getDataset: () => "TAXI_STANDS",
    getSource: () => "LTA_DATAMALL",
    getPaths: () => ["/Crowd?Line=A", "/Crowd?Line=B", "/Crowd?Line=C"],
    getRefreshInterval: () => INTERVAL,
    prepare: (responses) => responses.map(String),
  };

  it("makes one request per path and hands prepare() the answers in the paths' order", async () => {
    const facade = fakeFacade();
    facade.fetch.mockImplementation(async (_p, path) => {
      if (path.endsWith("A")) await new Promise((resolve) => setTimeout(resolve, 50)); // A answers last
      return path.slice(-1);
    });
    sync = new SyncService(facade, cache, [perLine], RETRY);

    const started = sync.start();
    await vi.advanceTimersByTimeAsync(50);
    await started;

    expect(facade.fetch.mock.calls.map(([, path]) => path)).toEqual([
      "/Crowd?Line=A",
      "/Crowd?Line=B",
      "/Crowd?Line=C",
    ]);
    expect(cache.get("TAXI_STANDS")?.data).toEqual(["A", "B", "C"]);
  });

  it("asks for every path at once rather than one after another", async () => {
    const facade = fakeFacade();
    let inFlight = 0;
    let most = 0;
    facade.fetch.mockImplementation(async () => {
      most = Math.max(most, ++inFlight);
      await new Promise((resolve) => setTimeout(resolve, 10));
      inFlight--;
      return "x";
    });
    sync = new SyncService(facade, cache, [perLine], RETRY);

    const started = sync.start();
    await vi.advanceTimersByTimeAsync(10);
    await started;

    expect(most).toBe(3);
  });

  it("stores nothing when one of the requests fails, keeps the last good copy, and retries", async () => {
    const facade = fakeFacade();
    facade.fetch.mockResolvedValue("ok");
    sync = new SyncService(facade, cache, [perLine], RETRY);
    await sync.start();
    const good = cache.get("TAXI_STANDS");

    facade.fetch.mockImplementation(async (_p, path) => {
      if (path.endsWith("B")) throw new Error("line B is down");
      return "new";
    });
    await vi.advanceTimersByTimeAsync(INTERVAL);

    expect(cache.get("TAXI_STANDS")).toEqual(good);
    facade.fetch.mockResolvedValue("back");
    await vi.advanceTimersByTimeAsync(RETRY);
    expect(cache.get("TAXI_STANDS")?.data).toEqual(["back", "back", "back"]);
  });
});

// Package 3 — buildSuggestions: strategies rebuild their sites whenever one of their inputs changes.
describe("SyncService.buildSuggestions (package 3)", () => {
  /** A strategy that counts its builds and stores how many stands it saw. */
  function countingStrategy(inputs: Dataset[], fail = false): SuggestionStrategy<number[]> & { builds: number } {
    return {
      builds: 0,
      getDataset: () => "PICKUP_SITES",
      getInputs: () => inputs,
      buildSites(c) {
        this.builds++;
        if (fail) throw new Error("bad formula");
        const stands = c.get("TAXI_STANDS")?.data as unknown[] | undefined;
        return stands ? [stands.length] : undefined;
      },
    };
  }

  it("rebuilds a strategy's sites after a sync of one of its inputs, and stores them", async () => {
    const facade = fakeFacade();
    facade.fetch.mockResolvedValue(["stand A", "stand B"]);
    const strategy = countingStrategy(["TAXI_STANDS"]);
    sync = new SyncService(facade, cache, [adapter], RETRY, [strategy]);

    await sync.start();

    expect(strategy.builds).toBe(1);
    expect(cache.get("PICKUP_SITES")?.data).toEqual([2]);
  });

  it("leaves a strategy alone when the dataset that changed isn't one of its inputs", async () => {
    const facade = fakeFacade();
    facade.fetch.mockResolvedValue(["stand A"]);
    const strategy = countingStrategy(["HOTSPOTS"]);
    sync = new SyncService(facade, cache, [adapter], RETRY, [strategy]);

    await sync.start();

    expect(strategy.builds).toBe(0);
  });

  it("stores nothing while the strategy can't build yet (an input it needs isn't loaded)", async () => {
    const facade = fakeFacade();
    facade.fetch.mockResolvedValue(["x"]);
    const notYet: SuggestionStrategy<unknown> = {
      getDataset: () => "PICKUP_SITES",
      getInputs: () => ["TAXI_STANDS"],
      buildSites: () => undefined,
    };
    sync = new SyncService(facade, cache, [adapter], RETRY, [notYet]);

    await sync.start();

    expect(cache.get("PICKUP_SITES")).toBeUndefined();
  });

  it("logs a strategy that fails, without failing the sync that triggered it", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const facade = fakeFacade();
    facade.fetch.mockResolvedValue(["stand A"]);
    sync = new SyncService(facade, cache, [adapter], RETRY, [countingStrategy(["TAXI_STANDS"], true)]);

    await sync.start();

    expect(cache.get("TAXI_STANDS")?.data).toEqual(["stand A"]); // the sync still stored its data
    expect(errors).toHaveBeenCalledWith(expect.stringMatching(/Building PICKUP_SITES failed: bad formula/));
  });
});
