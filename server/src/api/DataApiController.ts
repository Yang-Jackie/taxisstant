import { ENDPOINTS, type ApiError, type Endpoint } from "@taxisstant/shared";
import { Router, type Request, type Response } from "express";
import type { Dataset } from "../cache/Dataset.js";
import type { ServerDataCache } from "../cache/ServerDataCache.js";

/** Which dataset each endpoint serves, and what to call it while it isn't loaded yet. */
interface Route {
  readonly endpoint: Endpoint<unknown>;
  readonly dataset: Dataset;
  readonly label: string;
}

const ROUTES: readonly Route[] = [
  { endpoint: ENDPOINTS.taxiStands, dataset: "TAXI_STANDS", label: "Taxi stand" },
  { endpoint: ENDPOINTS.carparks, dataset: "CARPARKS", label: "Carpark" },
  { endpoint: ENDPOINTS.hawkerCentres, dataset: "HAWKER_CENTRES", label: "Hawker centre" },
  { endpoint: ENDPOINTS.fuelStations, dataset: "FUEL_STATIONS", label: "Fuel station" },
  { endpoint: ENDPOINTS.chargingStations, dataset: "CHARGING_STATIONS", label: "Charging station" },
  { endpoint: ENDPOINTS.taxis, dataset: "TAXIS", label: "Nearby taxi" },
  { endpoint: ENDPOINTS.carparkAvailability, dataset: "CARPARK_AVAILABILITY", label: "Carpark availability" },
  { endpoint: ENDPOINTS.chargerAvailability, dataset: "CHARGER_AVAILABILITY", label: "Charger availability" },
  { endpoint: ENDPOINTS.hotspots, dataset: "HOTSPOTS", label: "Hotspot" },
];

export class DataApiController {
  private readonly cache: ServerDataCache;

  constructor(cache: ServerDataCache) {
    this.cache = cache;
  }

  router(): Router {
    const router = Router();
    for (const route of ROUTES) router.get(route.endpoint.path, (req, res) => this.serve(route, req, res));
    router.use((req, res) => {
      res.status(404).json({ error: `No such endpoint: ${req.originalUrl}` } satisfies ApiError);
    });
    return router;
  }

  /** 200 with the data, 304 if the client's copy is current, or 503 until the first sync lands (D7). */
  private serve({ dataset, label }: Route, req: Request, res: Response): void {
    const entry = this.cache.get(dataset);
    if (!entry) {
      res.status(503).json({ error: `${label} data is not loaded yet` } satisfies ApiError);
      return;
    }
    res.set("ETag", entry.etag);
    if (req.get("If-None-Match") === entry.etag) {
      res.status(304).end();
      return;
    }
    res.json(entry);
  }
}
