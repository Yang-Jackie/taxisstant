// M2 acceptance tests — ServerDataCache «container»: the last good copy of each dataset, in memory.
// Note the ".js" in the imports: under NodeNext you import the file that will exist after compiling.
import { describe, expect, expectTypeOf, it } from "vitest";
import type { ApiResponse } from "../contract/ApiResponse.js";
import { ServerDataCache } from "./ServerDataCache.js";

const stands = [{ id: "A" }, { id: "B" }];

describe("ServerDataCache", () => {
  it("has nothing for a dataset that was never stored", () => {
    expect(new ServerDataCache().get("TAXI_STANDS")).toBeUndefined();
  });

  it("wraps stored data as { asOf, etag, data }", () => {
    const cache = new ServerDataCache();
    cache.put("TAXI_STANDS", stands, new Date("2026-10-25T08:00:00Z"));

    const response = cache.get("TAXI_STANDS");
    expect(response?.data).toEqual(stands);
    expect(response?.asOf).toBe("2026-10-25T08:00:00.000Z"); // ISO 8601, in UTC
    expect(response?.etag).toMatch(/^".+"$/); // HTTP requires ETags to be in double quotes
  });

  it("returns data typed as unknown — the cache doesn't know what each dataset contains", () => {
    expectTypeOf(new ServerDataCache().get("TAXI_STANDS")).toEqualTypeOf<ApiResponse<unknown> | undefined>();
  });

  it("keeps the same ETag when the data hasn't changed, even if stored again later", () => {
    const cache = new ServerDataCache();
    cache.put("TAXI_STANDS", stands, new Date("2026-10-25T08:00:00Z"));
    const first = cache.get("TAXI_STANDS")?.etag;

    cache.put("TAXI_STANDS", [{ id: "A" }, { id: "B" }], new Date("2026-10-26T08:00:00Z")); // equal content, new array
    expect(cache.get("TAXI_STANDS")?.etag).toBe(first);
  });

  it("gives a different ETag when the data changes", () => {
    const cache = new ServerDataCache();
    cache.put("TAXI_STANDS", stands);
    const before = cache.get("TAXI_STANDS")?.etag;

    cache.put("TAXI_STANDS", [{ id: "A" }]);
    expect(cache.get("TAXI_STANDS")?.etag).not.toBe(before);
  });

  it("uses the current time when no time is given", () => {
    const cache = new ServerDataCache();
    const before = Date.now();
    cache.put("TAXI_STANDS", stands);
    const asOf = Date.parse(cache.get("TAXI_STANDS")?.asOf ?? "");
    expect(asOf).toBeGreaterThanOrEqual(before - 1);
    expect(asOf).toBeLessThanOrEqual(Date.now() + 1);
  });
});
