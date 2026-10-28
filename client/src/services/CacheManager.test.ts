// M7 acceptance tests — CacheManager: server responses saved on the phone, and how old each one is.
// The design model makes it a «singleton»; here startup.ts makes exactly one and passes it in (D10).
// Each test controls the clock by passing `now`, the same way DataApiClient takes a fake fetchFn.
import { describe, expect, it } from "vitest";
import { CacheManager } from "./CacheManager";
import { LocalStore } from "./LocalStore";

const DAY = 24 * 60 * 60 * 1000;
const response = { asOf: "2026-10-27T00:00:00.000Z", etag: '"v1"', data: [{ id: "A01", name: "Lucky Plaza" }] };

/** An in-memory stand-in for LocalStore — anything with read() and write() will do. */
function memoryStore(initial: Record<string, unknown> = {}) {
  const data = new Map<string, unknown>(Object.entries(initial));
  return { data, read: async (k: string) => data.get(k), write: async (k: string, v: unknown) => void data.set(k, v) };
}

describe("CacheManager", () => {
  it("has nothing for a key that was never saved", async () => {
    expect(await new CacheManager(memoryStore()).get("/taxi-stands")).toBeUndefined();
  });

  it("gives back what was saved", async () => {
    const cache = new CacheManager(memoryStore());
    await cache.put("/taxi-stands", response);
    expect(await cache.get("/taxi-stands")).toEqual(response);
  });

  it("keeps it for the next session (a new CacheManager on the same storage)", async () => {
    const store = memoryStore();
    await new CacheManager(store).put("/taxi-stands", response);
    expect(await new CacheManager(store).get("/taxi-stands")).toEqual(response);
  });

  it("works on the real LocalStore (IndexedDB)", async () => {
    await new CacheManager(new LocalStore()).put("/taxi-stands", response);
    expect(await new CacheManager(new LocalStore()).get("/taxi-stands")).toEqual(response);
  });

  it('saves each response under "cache:<key>", with the time it was saved', async () => {
    const store = memoryStore();
    await new CacheManager(store, () => 1234).put("/taxi-stands", response);
    expect(store.data.get("cache:/taxi-stands")).toEqual({ savedAt: 1234, response });
  });

  it("never overwrites anything else in LocalStore, such as the preferences", async () => {
    const preferences = { visibleLayers: ["TAXI_STAND"] };
    const store = memoryStore({ preferences });
    const cache = new CacheManager(store);

    await cache.put("preferences", response);

    expect(store.data.get("preferences")).toEqual(preferences);
    expect(await cache.get("preferences")).toEqual(response);
  });

  it("treats a damaged entry as nothing saved", async () => {
    const damaged: unknown[] = [
      "garbage",
      null,
      { savedAt: "yesterday", response },
      { savedAt: 0 },
      { savedAt: 0, response: null },
      { savedAt: 0, response: { data: [] } }, // no etag
      { savedAt: 0, response: { etag: '"v1"' } }, // no data
    ];
    for (const entry of damaged) {
      const cache = new CacheManager(memoryStore({ "cache:/taxi-stands": entry }));
      expect(await cache.get("/taxi-stands")).toBeUndefined();
      expect(await cache.isStale("/taxi-stands", DAY)).toBe(true);
    }
  });
});

describe("CacheManager.isStale", () => {
  it("counts something never saved as stale", async () => {
    expect(await new CacheManager(memoryStore()).isStale("/taxi-stands", DAY)).toBe(true);
  });

  it("is fresh until the time-to-live has passed, then stale", async () => {
    let now = 0;
    const cache = new CacheManager(memoryStore(), () => now);
    await cache.put("/taxi-stands", response);

    now = DAY - 1;
    expect(await cache.isStale("/taxi-stands", DAY)).toBe(false);
    now = DAY;
    expect(await cache.isStale("/taxi-stands", DAY)).toBe(true);
  });

  it("is fresh again once saved again", async () => {
    let now = 0;
    const cache = new CacheManager(memoryStore(), () => now);
    await cache.put("/taxi-stands", response);

    now = 3 * DAY;
    await cache.put("/taxi-stands", response);

    expect(await cache.isStale("/taxi-stands", DAY)).toBe(false);
  });

  it("measures each key separately", async () => {
    let now = 0;
    const cache = new CacheManager(memoryStore(), () => now);
    await cache.put("/taxi-stands", response);
    now = DAY;
    await cache.put("/carparks", response);

    expect(await cache.isStale("/taxi-stands", DAY)).toBe(true);
    expect(await cache.isStale("/carparks", DAY)).toBe(false);
  });
});
