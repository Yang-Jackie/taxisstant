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
    await expect(
      new ExternalApiFacade(new ApiKeyStore({}), fetchFn).fetch("LTA_DATAMALL", "/TaxiStands"),
    ).rejects.toThrow(/LTA_ACCOUNT_KEY/);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

// Package 2a — one client per provider, every call with a timeout.
const noKeys = new ApiKeyStore({});

/** A fake fetch that answers each call with the next Response in the list. */
function answering(...responses: Response[]) {
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => responses.shift()!);
}
const json = (body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json", ...headers } });

describe("ExternalApiFacade.fetch — LTA DataMall (package 2a)", () => {
  it("keeps a resource's own query string and adds $skip after it", async () => {
    const fetchFn = fakeFetch(ltaPage(3));
    await new ExternalApiFacade(keys, fetchFn).fetch("LTA_DATAMALL", "/PCDRealTime?TrainLine=EWL");

    const url = urlOf(fetchFn.mock.calls[0]!);
    expect(url.pathname).toBe("/ltaodataservice/PCDRealTime");
    expect(url.searchParams.get("TrainLine")).toBe("EWL");
    expect(url.searchParams.get("$skip")).toBe("0");
  });

  it("follows the download link of a file dataset (EVCBatch), without sending the key to the file host", async () => {
    const file = { LastUpdatedTime: "2026-10-28 17:15:00", evLocationsData: [{ name: "CLARKE QUAY" }] };
    const fetchFn = answering(
      json({ value: [{ Link: "https://files.example/ev.json?X-Amz-Signature=s3cret" }] }),
      json(file),
    );

    const result = await new ExternalApiFacade(keys, fetchFn).fetch("LTA_DATAMALL", "/EVCBatch");

    expect(result).toEqual(file);
    expect(String(fetchFn.mock.calls[1]![0])).toBe("https://files.example/ev.json?X-Amz-Signature=s3cret");
    expect(new Headers(fetchFn.mock.calls[1]![1]?.headers).has("AccountKey")).toBe(false);
  });

  it("never puts a link's query string (its signature) in an error message", async () => {
    const fetchFn = answering(
      json({ value: [{ Link: "https://files.example/ev.json?X-Amz-Signature=s3cret" }] }),
      new Response("denied", { status: 403, statusText: "Forbidden" }),
    );
    const error = await new ExternalApiFacade(keys, fetchFn).fetch("LTA_DATAMALL", "/EVCBatch").catch((e: Error) => e);
    expect(String(error)).toMatch(/files\.example\/ev\.json answered 403/);
    expect(String(error)).not.toMatch(/s3cret/);
  });
});

describe("ExternalApiFacade.fetch — data.gov.sg (package 2a)", () => {
  const poll = () => json({ code: 0, data: { url: "https://s3.example/hawker.csv" } }); // a body can be read only once

  it("asks for the dataset's download link, then downloads the file; needs no key", async () => {
    const fetchFn = answering(
      poll(),
      new Response("name,stalls\nAdam Road,32\n", { headers: { "content-type": "text/csv" } }),
    );

    await new ExternalApiFacade(noKeys, fetchFn).fetch("DATA_GOV_SG", "d_bda4baa634dd1cc7a6c7cad5f19e2d68");

    expect(String(fetchFn.mock.calls[0]![0])).toBe(
      "https://api-open.data.gov.sg/v1/public/api/datasets/d_bda4baa634dd1cc7a6c7cad5f19e2d68/poll-download",
    );
    expect(String(fetchFn.mock.calls[1]![0])).toBe("https://s3.example/hawker.csv");
  });

  it("turns a CSV file into one object per row, keyed by the header (quoted commas included)", async () => {
    const csv = 'name,address,stalls\nAdam Road Food Centre,"2, Adam Road, Singapore 289876",32\n';
    const rows = await new ExternalApiFacade(
      noKeys,
      answering(poll(), new Response(csv, { headers: { "content-type": "text/csv" } })),
    ).fetch("DATA_GOV_SG", "d_x");
    expect(rows).toEqual([{ name: "Adam Road Food Centre", address: "2, Adam Road, Singapore 289876", stalls: "32" }]);
  });

  it("returns a GeoJSON file as JSON", async () => {
    const geojson = { type: "FeatureCollection", features: [] };
    const linkToJson = json({ code: 0, data: { url: "https://s3.example/exits.geojson" } });
    const result = await new ExternalApiFacade(noKeys, answering(linkToJson, json(geojson))).fetch(
      "DATA_GOV_SG",
      "d_x",
    );
    expect(result).toEqual(geojson);
  });

  it("calls a real-time API (a path starting with /) directly, with no download step (package 2c)", async () => {
    const taxis = {
      type: "FeatureCollection",
      features: [{ geometry: { type: "MultiPoint", coordinates: [[103.8, 1.3]] } }],
    };
    const fetchFn = answering(json(taxis));

    const result = await new ExternalApiFacade(noKeys, fetchFn).fetch("DATA_GOV_SG", "/v1/transport/taxi-availability");

    expect(result).toEqual(taxis);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(String(fetchFn.mock.calls[0]![0])).toBe("https://api.data.gov.sg/v1/transport/taxi-availability");
  });

  it("rejects when data.gov.sg gives no download link", async () => {
    const fetchFn = answering(json({ code: 1, errorMsg: "Dataset not found" }));
    await expect(new ExternalApiFacade(noKeys, fetchFn).fetch("DATA_GOV_SG", "d_missing")).rejects.toThrow();
  });
});

describe("ExternalApiFacade.fetch — OpenStreetMap Overpass (package 2a, D12)", () => {
  const query = '[out:json];nwr["amenity"="fuel"];out center tags;';

  it("POSTs the query, identifying the app as OSM's usage policy asks; needs no key", async () => {
    const fetchFn = answering(json({ elements: [{ id: 1 }] }));

    const result = await new ExternalApiFacade(noKeys, fetchFn).fetch("OSM_OVERPASS", query);

    const [url, init] = fetchFn.mock.calls[0]!;
    expect(String(url)).toBe("https://overpass-api.de/api/interpreter");
    expect(init?.method).toBe("POST");
    expect(new URLSearchParams(String(init?.body)).get("data")).toBe(query);
    expect(new Headers(init?.headers).get("user-agent")).toMatch(/^taxisstant\//);
    expect(result).toEqual({ elements: [{ id: 1 }] });
  });

  it("rejects a 200 that carries an error remark, instead of passing on partial data", async () => {
    const partial = json({
      elements: [],
      remark: 'runtime error: Query timed out in "query" at line 1 after 90 seconds.',
    });
    await expect(new ExternalApiFacade(noKeys, answering(partial)).fetch("OSM_OVERPASS", query)).rejects.toThrow(
      /timed out/,
    );
  });

  it("rejects when the server is at capacity (429 or 504)", async () => {
    const busy = new Response("busy", { status: 429, statusText: "Too Many Requests" });
    await expect(new ExternalApiFacade(noKeys, answering(busy)).fetch("OSM_OVERPASS", query)).rejects.toThrow(/429/);
  });
});

describe("ExternalApiFacade — timeouts (package 2a)", () => {
  it("gives up on a provider that never answers, so one stuck dataset can't stall its sync forever", async () => {
    const neverAnswers = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) =>
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted"))),
        ),
    );
    await expect(new ExternalApiFacade(noKeys, neverAnswers, 20).fetch("OSM_OVERPASS", "q")).rejects.toThrow(
      /overpass-api\.de\/api\/interpreter failed/,
    );
  });
});
