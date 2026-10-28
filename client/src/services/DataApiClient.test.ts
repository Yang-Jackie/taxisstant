// M5 acceptance tests — DataApiClient «boundary» (services layer): the client's only way to reach
// our server. GETs JSON, sends the ETag it already has, and gives up after 7 seconds (NF-3.1.1).
// Package 1: it takes an endpoint from the shared contract and checks the body against that endpoint's schema.
import { ENDPOINTS } from "@taxisstant/shared";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { DataApiClient } from "./DataApiClient";

const stand = {
  id: "A01",
  name: "Lucky Plaza",
  latitude: 1.3043,
  longitude: 103.8338,
  standType: "Stand",
  isBarrierFree: true,
};
const body = { asOf: "2026-10-26T12:00:00.000Z", etag: '"abc"', data: [stand] };
const taxiStands = ENDPOINTS.taxiStands;

/** A fake fetch that always answers with the given status (and JSON body, if any). */
function answering(status: number, json?: unknown) {
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
    json === undefined ? new Response(null, { status }) : new Response(JSON.stringify(json), { status }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DataApiClient.get", () => {
  it("GETs /api + the endpoint by default", async () => {
    const fetchFn = answering(200, body);
    await new DataApiClient({ fetchFn }).get(taxiStands);
    expect(String(fetchFn.mock.calls[0]![0])).toBe("/api/taxi-stands");
  });

  it('returns { status: "ok", response } with the server\'s { asOf, etag, data } on 200', async () => {
    const result = await new DataApiClient({ fetchFn: answering(200, body) }).get(taxiStands);
    expect(result).toEqual({ status: "ok", response: body });
  });

  it("sends If-None-Match when it already has a version", async () => {
    const fetchFn = answering(304);
    await new DataApiClient({ fetchFn }).get(taxiStands, '"abc"');
    expect(new Headers(fetchFn.mock.calls[0]![1]?.headers).get("If-None-Match")).toBe('"abc"');
  });

  it("doesn't send If-None-Match when it has nothing yet", async () => {
    const fetchFn = answering(200, body);
    await new DataApiClient({ fetchFn }).get(taxiStands);
    expect(new Headers(fetchFn.mock.calls[0]![1]?.headers).has("If-None-Match")).toBe(false);
  });

  it('returns { status: "not-modified" } on 304', async () => {
    const result = await new DataApiClient({ fetchFn: answering(304) }).get(taxiStands, '"abc"');
    expect(result).toEqual({ status: "not-modified" });
  });

  it("rejects on an error status, e.g. 503 before the server has data", async () => {
    await expect(
      new DataApiClient({ fetchFn: answering(503, { error: "not loaded" }) }).get(taxiStands),
    ).rejects.toThrow(/503/);
  });

  it("rejects when the network fails", async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(new DataApiClient({ fetchFn }).get(taxiStands)).rejects.toThrow();
  });

  it("gives up after timeoutMs instead of waiting forever (NF-3.1.1)", async () => {
    // A server that never answers — it only stops when the request is aborted.
    const fetchFn = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    );
    await expect(new DataApiClient({ fetchFn, timeoutMs: 20 }).get(taxiStands)).rejects.toThrow(/timed out/i);
  });

  it("always attaches an abort signal, so a slow request can be cut off", async () => {
    const fetchFn = answering(200, body);
    await new DataApiClient({ fetchFn }).get(taxiStands);
    expect(fetchFn.mock.calls[0]![1]?.signal).toBeDefined();
  });

  it("calls the browser's own fetch correctly when none is passed in", async () => {
    // Browsers throw "Illegal invocation" if fetch is called as a method of some other object.
    const strictFetch = vi.fn(function (this: unknown) {
      if (this !== undefined && this !== globalThis) throw new TypeError("Illegal invocation");
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
    });
    vi.stubGlobal("fetch", strictFetch);

    await expect(new DataApiClient().get(taxiStands)).resolves.toEqual({ status: "ok", response: body });
  });
});

describe("DataApiClient.get checks the body against the endpoint's schema (package 1)", () => {
  it("gives back data typed by the endpoint, with no casts anywhere", async () => {
    const result = await new DataApiClient({ fetchFn: answering(200, body) }).get(taxiStands);
    if (result.status === "ok") expectTypeOf(result.response.data[0]!.latitude).toEqualTypeOf<number>();
    expect(result.status).toBe("ok");
  });

  it("rejects a 200 whose body breaks the contract, and says which field", async () => {
    const broken = { ...body, data: [{ ...stand, latitude: "1.30" }] };
    await expect(new DataApiClient({ fetchFn: answering(200, broken) }).get(taxiStands)).rejects.toThrow(
      /breaks the contract \(data\.0\.latitude:/,
    );
  });

  it("rejects a 200 that isn't JSON at all", async () => {
    const fetchFn = vi.fn(async () => new Response("<html>Bad Gateway</html>", { status: 200 }));
    await expect(new DataApiClient({ fetchFn }).get(taxiStands)).rejects.toThrow(/breaks the contract \(body:/);
  });

  it("drops fields the contract doesn't mention", async () => {
    const result = await new DataApiClient({ fetchFn: answering(200, { ...body, debug: true }) }).get(taxiStands);
    expect(result).toEqual({ status: "ok", response: body });
  });
});
