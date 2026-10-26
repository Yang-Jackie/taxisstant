// M3 acceptance tests — ExternalApiFacade «facade»: the only class that talks to outside APIs.
// A fake fetch stands in for the network, so these tests never touch LTA and never need a real key.
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { ApiKeyStore } from "./ApiKeyStore.js";
import { ExternalApiFacade } from "./ExternalApiFacade.js";

const recorded = JSON.parse(
  readFileSync(new URL("../sample-data/lta-taxi-stands.raw.json", import.meta.url), "utf8"),
) as { value: unknown[] };

const keys = new ApiKeyStore({ LTA_ACCOUNT_KEY: "test-key" });

/** A fake fetch that answers each call with the next body in the list, as JSON. */
function fakeFetch(...bodies: unknown[]) {
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
    return new Response(JSON.stringify(bodies.shift()), { status: 200 });
  });
}

/** LTA-shaped page with `n` rows. */
function ltaPage(n: number) {
  return { "odata.metadata": "…", value: Array.from({ length: n }, (_, i) => ({ row: i })) };
}

function urlOf(call: unknown[]) {
  return new URL(String(call[0]));
}

describe("ExternalApiFacade.fetch", () => {
  it("calls LTA DataMall at the adapter's path, sending the AccountKey header", async () => {
    const fetchFn = fakeFetch(recorded);
    await new ExternalApiFacade(keys, fetchFn).fetch("LTA_DATAMALL", "/TaxiStands");

    const [url, init] = fetchFn.mock.calls[0]!;
    expect(String(url)).toMatch(/^https:\/\/datamall2\.mytransport\.sg\/ltaodataservice\/TaxiStands/);
    expect(new Headers(init?.headers).get("AccountKey")).toBe("test-key");
  });

  it("returns the rows inside LTA's { value: [...] } envelope", async () => {
    const rows = await new ExternalApiFacade(keys, fakeFetch(recorded)).fetch("LTA_DATAMALL", "/TaxiStands");
    expect(rows).toEqual(recorded.value);
  });

  it("makes one request when everything fits on one page (under 500 rows)", async () => {
    const fetchFn = fakeFetch(recorded);
    await new ExternalApiFacade(keys, fetchFn).fetch("LTA_DATAMALL", "/TaxiStands");
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("follows LTA's 500-row pages with $skip, and joins them", async () => {
    const fetchFn = fakeFetch(ltaPage(500), ltaPage(3));
    const rows = await new ExternalApiFacade(keys, fetchFn).fetch("LTA_DATAMALL", "/TaxiStands");

    expect(rows).toHaveLength(503);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(urlOf(fetchFn.mock.calls[0]!).searchParams.get("$skip") ?? "0").toBe("0");
    expect(urlOf(fetchFn.mock.calls[1]!).searchParams.get("$skip")).toBe("500");
  });

  it("stops when a page comes back empty (exactly 500 rows in total)", async () => {
    const fetchFn = fakeFetch(ltaPage(500), ltaPage(0));
    const rows = await new ExternalApiFacade(keys, fetchFn).fetch("LTA_DATAMALL", "/TaxiStands");
    expect(rows).toHaveLength(500);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("rejects when LTA answers with an error status", async () => {
    const fetchFn = vi.fn(async () => new Response("Unauthorized", { status: 401 }));
    await expect(new ExternalApiFacade(keys, fetchFn).fetch("LTA_DATAMALL", "/TaxiStands")).rejects.toThrow(/401/);
  });

  it("rejects a response that isn't LTA-shaped", async () => {
    await expect(
      new ExternalApiFacade(keys, fakeFetch({ unexpected: true })).fetch("LTA_DATAMALL", "/TaxiStands"),
    ).rejects.toThrow();
  });

  it("never calls out without a key", async () => {
    const fetchFn = fakeFetch(recorded);
    await expect(new ExternalApiFacade(new ApiKeyStore({}), fetchFn).fetch("LTA_DATAMALL", "/TaxiStands")).rejects.toThrow(
      /LTA_ACCOUNT_KEY/,
    );
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
