// Contract tests — what the server really sends matches the shared zod schemas the client checks it with.
// Runs real recorded provider data through each adapter, the cache and the controller, as a live sync would.
import { readFileSync } from "node:fs";
import { ApiError, ENDPOINTS } from "@taxisstant/shared";
import express from "express";
import request from "supertest";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { ServerDataCache } from "../cache/ServerDataCache.js";
import { loadSample } from "../sample-data/samples.js";
import { CarparkAdapter } from "../sync/adapters/CarparkAdapter.js";
import { CarparkAvailabilityAdapter } from "../sync/adapters/CarparkAvailabilityAdapter.js";
import { ChargerAvailabilityAdapter } from "../sync/adapters/ChargerAvailabilityAdapter.js";
import { ChargingStationAdapter } from "../sync/adapters/ChargingStationAdapter.js";
import { FuelStationAdapter } from "../sync/adapters/FuelStationAdapter.js";
import { HawkerCentreAdapter } from "../sync/adapters/HawkerCentreAdapter.js";
import { HotspotAdapter } from "../sync/adapters/HotspotAdapter.js";
import { TaxiAdapter } from "../sync/adapters/TaxiAdapter.js";
import { PickupSuggestionStrategy } from "../sync/strategies/PickupSuggestionStrategy.js";
import { RestStopSuggestionStrategy } from "../sync/strategies/RestStopSuggestionStrategy.js";
import type { SuggestionStrategy } from "../sync/strategies/SuggestionStrategy.js";
import { TaxiStandAdapter } from "../sync/adapters/TaxiStandAdapter.js";
import type { DatasetAdapter } from "../sync/DatasetAdapter.js";
import { DataApiController } from "./DataApiController.js";

const taxiStands = JSON.parse(
  readFileSync(new URL("../sample-data/lta-taxi-stands.raw.json", import.meta.url), "utf8"),
) as { value: unknown };

/** Each endpoint, the adapter that feeds it, and real recorded answers for that adapter (one per path, D21). */
const CASES: [keyof typeof ENDPOINTS, DatasetAdapter<unknown>, readonly unknown[]][] = [
  ["taxiStands", new TaxiStandAdapter(), [taxiStands.value]],
  ["carparks", new CarparkAdapter(), [loadSample("carparks")]],
  ["hawkerCentres", new HawkerCentreAdapter(), [loadSample("hawkerCentres")]],
  ["fuelStations", new FuelStationAdapter(), [loadSample("fuelStations")]],
  ["chargingStations", new ChargingStationAdapter(), [loadSample("chargingStations")]],
  ["taxis", new TaxiAdapter(), [loadSample("taxis")]],
  ["carparkAvailability", new CarparkAvailabilityAdapter(), [loadSample("carparks")]],
  ["chargerAvailability", new ChargerAvailabilityAdapter(), [loadSample("chargingStations")]],
  ["hotspots", new HotspotAdapter(), loadSample("hotspots") as unknown[]],
];

/** Endpoints built by a strategy from the other datasets, not fetched by an adapter (package 3). */
const BUILT: [keyof typeof ENDPOINTS, SuggestionStrategy<unknown>][] = [
  ["pickupSites", new PickupSuggestionStrategy()],
  ["restStopSites", new RestStopSuggestionStrategy()],
];

/** A cache holding every adapter's dataset, prepared from its real recorded answers, as of `now`. */
function cacheWithEverything(now: Date) {
  const cache = new ServerDataCache();
  for (const [, adapter, responses] of CASES) cache.put(adapter.getDataset(), adapter.prepare(responses), now);
  return cache;
}

function appWith(cache: ServerDataCache) {
  const app = express();
  app.use("/api", new DataApiController(cache).router());
  return app;
}

describe("the server keeps to the shared contract", () => {
  beforeAll(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {}); // unopened stations in the crowd data
  });

  it("covers every endpoint in ENDPOINTS", () => {
    const covered = [...CASES.map(([name]) => name), ...BUILT.map(([name]) => name)];
    expect(covered.sort()).toEqual(Object.keys(ENDPOINTS).sort());
  });

  for (const [name, adapter, responses] of CASES) {
    it(`GET /api${ENDPOINTS[name].path} sends exactly what ENDPOINTS.${name}.response describes`, async () => {
      const cache = new ServerDataCache();
      cache.put(adapter.getDataset(), adapter.prepare(responses));

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

  for (const [name, strategy] of BUILT) {
    it(`GET /api${ENDPOINTS[name].path} sends exactly what ENDPOINTS.${name}.response describes, built from the real data`, async () => {
      const cache = cacheWithEverything(new Date());
      cache.put(strategy.getDataset(), strategy.buildSites(cache, new Date()));

      const res = await request(appWith(cache)).get(`/api${ENDPOINTS[name].path}`);

      expect(res.status).toBe(200);
      const parsed = ENDPOINTS[name].response.parse(res.body);
      expect(parsed).toEqual(res.body);
      expect(parsed.data.length).toBeGreaterThan(100);
    });
  }
});
