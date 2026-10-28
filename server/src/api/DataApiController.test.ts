// M2 acceptance tests — DataApiController «boundary»: GET /api/taxi-stands over real HTTP (via Supertest).
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { DataApiController } from "./DataApiController.js";
import { ServerDataCache } from "../cache/ServerDataCache.js";

/** Builds an app the same way DataServiceApp will: the controller's router mounted under /api. */
function appWith(cache: ServerDataCache) {
  const app = express();
  app.use("/api", new DataApiController(cache).router());
  return app;
}

const stands = [{ id: "SAMPLE-01", name: "Raffles City" }];

function cacheWithStands() {
  const cache = new ServerDataCache();
  cache.put("TAXI_STANDS", stands, new Date("2026-10-25T08:00:00Z"));
  return cache;
}

describe("GET /api/taxi-stands", () => {
  it("answers 503 Service Unavailable before the data has ever been loaded", async () => {
    const res = await request(appWith(new ServerDataCache())).get("/api/taxi-stands");
    expect(res.status).toBe(503);
  });

  it("answers 200 with { asOf, etag, data } as JSON", async () => {
    const res = await request(appWith(cacheWithStands())).get("/api/taxi-stands");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body).toEqual({
      asOf: "2026-10-25T08:00:00.000Z",
      etag: expect.stringMatching(/^".+"$/),
      data: stands,
    });
  });

  it("sends the same ETag in the response header as in the body", async () => {
    const res = await request(appWith(cacheWithStands())).get("/api/taxi-stands");
    expect(res.headers["etag"]).toBe(res.body.etag);
  });

  it("answers 304 Not Modified, with no body, when the client already has this version", async () => {
    const cache = cacheWithStands();
    const etag = cache.get("TAXI_STANDS")?.etag ?? "";

    const res = await request(appWith(cache)).get("/api/taxi-stands").set("If-None-Match", etag);

    expect(res.status).toBe(304);
    expect(res.text ?? "").toBe("");
  });

  it("answers 200 with the new data when the client's version is out of date", async () => {
    const res = await request(appWith(cacheWithStands()))
      .get("/api/taxi-stands")
      .set("If-None-Match", '"an-old-version"');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(stands);
  });

  it("starts answering 200 as soon as data arrives, without rebuilding the app", async () => {
    // Arrange: one cache, one app, built while the cache is still empty
    const cache = new ServerDataCache();
    const app = appWith(cache);

    // Act + assert, part 1: before any data
    const before = await request(app).get("/api/taxi-stands");
    expect(before.status).toBe(503);

    // Data arrives later, the way M3's first sync will
    cache.put("TAXI_STANDS", [{ id: "SAMPLE-01" }]);

    // Act + assert, part 2: the same app now serves it
    const after = await request(app).get("/api/taxi-stands");
    expect(after.status).toBe(200);
    expect(after.body.data).toEqual([{ id: "SAMPLE-01" }]);
  });

  it("says why when answering 503", async () => {
    const cache = new ServerDataCache();
    const app = appWith(cache);

    const res = await request(app).get("/api/taxi-stands");
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ error: expect.any(String) });
  });

  it("answers 404 for paths it doesn't serve", async () => {
    const app = appWith(cacheWithStands());

    const res = await request(app).get("/api/none");
    expect(res.status).toBe(404);
  });
});
