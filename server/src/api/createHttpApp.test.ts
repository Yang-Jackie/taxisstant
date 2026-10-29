// Package 2b tests — the HTTP app as DataServiceApp runs it: gzip on top of the API (moved forward from 2e).
import { get } from "node:http";
import type { AddressInfo } from "node:net";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { ServerDataCache } from "../cache/ServerDataCache.js";
import { loadSample } from "../sample-data/samples.js";
import { ChargingStationAdapter } from "../sync/adapters/ChargingStationAdapter.js";
import { createHttpApp } from "./createHttpApp.js";

function appWithChargers() {
  const cache = new ServerDataCache();
  cache.put("CHARGING_STATIONS", new ChargingStationAdapter().prepare([loadSample("chargingStations")]));
  return createHttpApp(cache, { log: false });
}

describe("createHttpApp", () => {
  it("gzips responses for clients that accept it, to a fraction of their size", async () => {
    // Count the bytes actually sent: the response is chunked, so there is no Content-Length to read
    const server = appWithChargers().listen(0);
    const { port } = server.address() as AddressInfo;
    const { encoding, bytes } = await new Promise<{ encoding?: string; bytes: number }>((resolve, reject) => {
      get({ port, path: "/api/charging-stations", headers: { "accept-encoding": "gzip" } }, (res) => {
        let bytes = 0;
        res.on("data", (chunk: Buffer) => (bytes += chunk.length));
        res.on("end", () => resolve({ encoding: res.headers["content-encoding"], bytes }));
      }).on("error", reject);
    }).finally(() => server.close());
    const plain = await request(appWithChargers()).get("/api/charging-stations").set("Accept-Encoding", "identity");

    expect(encoding).toBe("gzip");
    expect(bytes).toBeLessThan(plain.text.length / 5);
  });

  it("sends plain JSON to a client that doesn't accept gzip", async () => {
    const res = await request(appWithChargers()).get("/api/charging-stations").set("Accept-Encoding", "identity");
    expect(res.headers["content-encoding"]).toBeUndefined();
    expect(res.body.data.length).toBeGreaterThan(1000);
  });

  it("keeps ETags and 304s working with compression on", async () => {
    const app = appWithChargers();
    const first = await request(app).get("/api/charging-stations").set("Accept-Encoding", "gzip");
    expect(first.headers["etag"]).toBe(first.body.etag);

    const again = await request(app)
      .get("/api/charging-stations")
      .set("Accept-Encoding", "gzip")
      .set("If-None-Match", first.headers["etag"]!);
    expect(again.status).toBe(304);
  });

  it("serves the API under /api", async () => {
    const res = await request(createHttpApp(new ServerDataCache(), { log: false })).get("/api/none");
    expect(res.status).toBe(404);
  });
});

// Package 2e — HTTP hardening (D27): no framework header, a per-client rate limit, a CORS allow-list.
describe("createHttpApp — hardening (package 2e)", () => {
  const withStands = (options: Parameters<typeof createHttpApp>[1] = {}) => {
    const cache = new ServerDataCache();
    cache.put("TAXI_STANDS", [{ id: "A01" }]);
    return createHttpApp(cache, { log: false, ...options });
  };

  it("doesn't say it runs Express", async () => {
    const res = await request(withStands()).get("/api/taxi-stands");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("asks clients to re-check a saved copy with its ETag before reusing it (Cache-Control: no-cache)", async () => {
    const app = withStands();
    const first = await request(app).get("/api/taxi-stands");
    expect(first.headers["cache-control"]).toBe("no-cache");
    const again = await request(app).get("/api/taxi-stands").set("If-None-Match", first.headers["etag"]!);
    expect(again.status).toBe(304);
  });

  it("answers 429 with a reason and a Retry-After once a client goes over its requests for the minute", async () => {
    const app = withStands({ rateLimitPerMinute: 3 });
    for (let i = 0; i < 3; i++) expect((await request(app).get("/api/taxi-stands")).status).toBe(200);

    const over = await request(app).get("/api/taxi-stands");

    expect(over.status).toBe(429);
    expect(over.body).toEqual({ error: "Too many requests. Please try again in a minute." });
    expect(Number(over.headers["retry-after"])).toBeGreaterThan(0);
    expect(over.headers["ratelimit-policy"]).toMatch(/q=3/);
  });

  it("counts each client separately when it knows their real addresses behind a proxy (TRUST_PROXY)", async () => {
    const app = withStands({ rateLimitPerMinute: 1, trustProxy: 1 });
    expect((await request(app).get("/api/taxi-stands").set("X-Forwarded-For", "203.0.113.1")).status).toBe(200);
    expect((await request(app).get("/api/taxi-stands").set("X-Forwarded-For", "203.0.113.1")).status).toBe(429);
    expect((await request(app).get("/api/taxi-stands").set("X-Forwarded-For", "203.0.113.2")).status).toBe(200);
  });

  it("ignores X-Forwarded-For when there's no proxy, so a client can't dodge the limit by faking it", async () => {
    const app = withStands({ rateLimitPerMinute: 1 });
    await request(app).get("/api/taxi-stands").set("X-Forwarded-For", "203.0.113.1");
    expect((await request(app).get("/api/taxi-stands").set("X-Forwarded-For", "203.0.113.2")).status).toBe(429);
  });

  it("sends no CORS headers by default, not even to a preflight: the app is served from the same origin (D27)", async () => {
    const res = await request(withStands()).get("/api/taxi-stands").set("Origin", "https://elsewhere.example");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();

    const preflight = await request(withStands())
      .options("/api/taxi-stands")
      .set("Origin", "https://elsewhere.example")
      .set("Access-Control-Request-Method", "GET");
    expect(Object.keys(preflight.headers).filter((h) => h.startsWith("access-control-"))).toEqual([]);
  });

  it("allows only the listed origins, and lets them read the ETag", async () => {
    const app = withStands({ corsOrigins: ["https://taxi.example"] });

    const allowed = await request(app).get("/api/taxi-stands").set("Origin", "https://taxi.example");
    expect(allowed.headers["access-control-allow-origin"]).toBe("https://taxi.example");
    expect(allowed.headers["access-control-expose-headers"]).toBe("ETag");

    const other = await request(app).get("/api/taxi-stands").set("Origin", "https://elsewhere.example");
    expect(other.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("answers a listed origin's preflight for an ETag re-check (If-None-Match isn't a simple header)", async () => {
    const res = await request(withStands({ corsOrigins: ["https://taxi.example"] }))
      .options("/api/taxi-stands")
      .set("Origin", "https://taxi.example")
      .set("Access-Control-Request-Method", "GET")
      .set("Access-Control-Request-Headers", "if-none-match");
    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-headers"]).toMatch(/If-None-Match/i);
    expect(res.headers["access-control-allow-methods"]).toBe("GET");
  });

  it("keeps a 429 readable by an allowed site", async () => {
    const app = withStands({ corsOrigins: ["https://taxi.example"], rateLimitPerMinute: 1 });
    await request(app).get("/api/taxi-stands").set("Origin", "https://taxi.example");
    const over = await request(app).get("/api/taxi-stands").set("Origin", "https://taxi.example");
    expect(over.status).toBe(429);
    expect(over.headers["access-control-allow-origin"]).toBe("https://taxi.example");
  });
});

describe("createHttpApp — the request log", () => {
  it("logs each request with its answer and how long it took", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await request(createHttpApp(new ServerDataCache())).get("/api/taxi-stands");
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/^GET \/api\/taxi-stands -> 503 \(\d+ ms\)$/));
    log.mockRestore();
  });
});
