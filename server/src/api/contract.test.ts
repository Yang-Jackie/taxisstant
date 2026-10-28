// Package 1 contract test — what the server really sends matches the shared zod schemas the client checks it with.
// Runs the real recorded LTA data through the adapter, the cache and the controller, like a live sync would.
import { readFileSync } from "node:fs";
import { ApiError, ENDPOINTS } from "@taxisstant/shared";
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { ServerDataCache } from "../cache/ServerDataCache.js";
import { TaxiStandAdapter } from "../sync/adapters/TaxiStandAdapter.js";
import { DataApiController } from "./DataApiController.js";

const recorded = JSON.parse(
  readFileSync(new URL("../sample-data/lta-taxi-stands.raw.json", import.meta.url), "utf8"),
) as { value: unknown };

function appWith(cache: ServerDataCache) {
  const app = express();
  app.use("/api", new DataApiController(cache).router());
  return app;
}

describe("the server keeps to the shared contract", () => {
  it(`GET /api${ENDPOINTS.taxiStands.path} sends exactly what ENDPOINTS.taxiStands.response describes`, async () => {
    const cache = new ServerDataCache();
    cache.put("TAXI_STANDS", new TaxiStandAdapter().prepare(recorded.value));

    const res = await request(appWith(cache)).get(`/api${ENDPOINTS.taxiStands.path}`);

    expect(res.status).toBe(200);
    const parsed = ENDPOINTS.taxiStands.response.parse(res.body); // throws, naming the field, if anything is off
    expect(parsed).toEqual(res.body); // nothing extra was stripped: the server sends no undocumented fields
    expect(parsed.data).toHaveLength(316);
  });

  it("sends an ApiError body for 503 and 404", async () => {
    const app = appWith(new ServerDataCache());
    for (const path of [`/api${ENDPOINTS.taxiStands.path}`, "/api/none"]) {
      const res = await request(app).get(path);
      expect(ApiError.parse(res.body)).toEqual(res.body);
    }
  });
});
