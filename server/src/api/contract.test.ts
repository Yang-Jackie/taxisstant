// Contract tests — what the server really sends matches the shared zod schemas the client checks it with.
// Runs real recorded provider data through each adapter, the cache and the controller, as a live sync would.
import { readFileSync } from "node:fs";
import { ApiError, ENDPOINTS } from "@taxisstant/shared";
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { ServerDataCache } from "../cache/ServerDataCache.js";
import { loadSample } from "../sample-data/samples.js";
import { CarparkAdapter } from "../sync/adapters/CarparkAdapter.js";
import { ChargingStationAdapter } from "../sync/adapters/ChargingStationAdapter.js";
import { FuelStationAdapter } from "../sync/adapters/FuelStationAdapter.js";
import { HawkerCentreAdapter } from "../sync/adapters/HawkerCentreAdapter.js";
import { TaxiStandAdapter } from "../sync/adapters/TaxiStandAdapter.js";
import type { DatasetAdapter } from "../sync/DatasetAdapter.js";
import { DataApiController } from "./DataApiController.js";

const taxiStands = JSON.parse(
  readFileSync(new URL("../sample-data/lta-taxi-stands.raw.json", import.meta.url), "utf8"),
) as { value: unknown };

/** Each endpoint, the adapter that feeds it, and a real recorded response for that adapter. */
const CASES: [keyof typeof ENDPOINTS, DatasetAdapter<unknown>, unknown][] = [
  ["taxiStands", new TaxiStandAdapter(), taxiStands.value],
  ["carparks", new CarparkAdapter(), loadSample("carparks")],
  ["hawkerCentres", new HawkerCentreAdapter(), loadSample("hawkerCentres")],
  ["fuelStations", new FuelStationAdapter(), loadSample("fuelStations")],
  ["chargingStations", new ChargingStationAdapter(), loadSample("chargingStations")],
];

function appWith(cache: ServerDataCache) {
  const app = express();
  app.use("/api", new DataApiController(cache).router());
  return app;
}

describe("the server keeps to the shared contract", () => {
  it("covers every endpoint in ENDPOINTS", () => {
    expect(CASES.map(([name]) => name).sort()).toEqual(Object.keys(ENDPOINTS).sort());
  });

  for (const [name, adapter, raw] of CASES) {
    it(`GET /api${ENDPOINTS[name].path} sends exactly what ENDPOINTS.${name}.response describes`, async () => {
      const cache = new ServerDataCache();
      cache.put(adapter.getDataset(), adapter.prepare(raw));

      const res = await request(appWith(cache)).get(`/api${ENDPOINTS[name].path}`);

      expect(res.status).toBe(200);
      const parsed = ENDPOINTS[name].response.parse(res.body); // throws, naming the field, if anything is off
      expect(parsed).toEqual(res.body); // nothing extra was stripped: the server sends no undocumented fields
      expect(parsed.data).not.toHaveLength(0);
    });
  }

  it("sends an ApiError body for 503 and 404", async () => {
    const app = appWith(new ServerDataCache());
    for (const path of [...Object.values(ENDPOINTS).map((e) => `/api${e.path}`), "/api/none"]) {
      const res = await request(app).get(path);
      expect(ApiError.parse(res.body)).toEqual(res.body);
    }
  });
});
