// Package 2b tests — the HTTP app as DataServiceApp runs it: gzip on top of the API (moved forward from 2e).
import { get } from "node:http";
import type { AddressInfo } from "node:net";
import request from "supertest";
import { describe, expect, it } from "vitest";
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
