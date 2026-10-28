// M5 acceptance tests — DataApiClient «boundary» (services layer): the client's only way to reach
// our server. GETs JSON, sends the ETag it already has, and gives up after 7 seconds (NF-3.1.1).
import { afterEach, describe, expect, it, vi } from "vitest";
import { DataApiClient } from "./DataApiClient";

const body = { asOf: "2026-10-26T12:00:00.000Z", etag: '"abc"', data: [{ id: "A01" }] };

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
    await new DataApiClient({ fetchFn }).get("/taxi-stands");
    expect(String(fetchFn.mock.calls[0]![0])).toBe("/api/taxi-stands");
  });

  it('returns { status: "ok", response } with the server\'s { asOf, etag, data } on 200', async () => {
    const result = await new DataApiClient({ fetchFn: answering(200, body) }).get("/taxi-stands");
    expect(result).toEqual({ status: "ok", response: body });
  });

  it("sends If-None-Match when it already has a version", async () => {
    const fetchFn = answering(304);
    await new DataApiClient({ fetchFn }).get("/taxi-stands", '"abc"');
    expect(new Headers(fetchFn.mock.calls[0]![1]?.headers).get("If-None-Match")).toBe('"abc"');
  });

  it("doesn't send If-None-Match when it has nothing yet", async () => {
    const fetchFn = answering(200, body);
    await new DataApiClient({ fetchFn }).get("/taxi-stands");
    expect(new Headers(fetchFn.mock.calls[0]![1]?.headers).has("If-None-Match")).toBe(false);
  });

  it('returns { status: "not-modified" } on 304', async () => {
    const result = await new DataApiClient({ fetchFn: answering(304) }).get("/taxi-stands", '"abc"');
    expect(result).toEqual({ status: "not-modified" });
  });

  it("rejects on an error status, e.g. 503 before the server has data", async () => {
    await expect(
      new DataApiClient({ fetchFn: answering(503, { error: "not loaded" }) }).get("/taxi-stands"),
    ).rejects.toThrow(/503/);
  });

  it("rejects when the network fails", async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(new DataApiClient({ fetchFn }).get("/taxi-stands")).rejects.toThrow();
  });

  it("gives up after timeoutMs instead of waiting forever (NF-3.1.1)", async () => {
    // A server that never answers — it only stops when the request is aborted.
    const fetchFn = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    );
    await expect(new DataApiClient({ fetchFn, timeoutMs: 20 }).get("/taxi-stands")).rejects.toThrow(/timed out/i);
  });

  it("always attaches an abort signal, so a slow request can be cut off", async () => {
    const fetchFn = answering(200, body);
    await new DataApiClient({ fetchFn }).get("/taxi-stands");
    expect(fetchFn.mock.calls[0]![1]?.signal).toBeDefined();
  });

  it("calls the browser's own fetch correctly when none is passed in", async () => {
    // Browsers throw "Illegal invocation" if fetch is called as a method of some other object.
    const strictFetch = vi.fn(function (this: unknown) {
      if (this !== undefined && this !== globalThis) throw new TypeError("Illegal invocation");
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
    });
    vi.stubGlobal("fetch", strictFetch);

    await expect(new DataApiClient().get("/taxi-stands")).resolves.toEqual({ status: "ok", response: body });
  });
});
