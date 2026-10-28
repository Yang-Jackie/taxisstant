import { ENDPOINTS, type ApiError } from "@taxisstant/shared";
import { Router, type Request, type Response } from "express";
import type { ServerDataCache } from "../cache/ServerDataCache.js";

export class DataApiController {
  private readonly cache: ServerDataCache;

  constructor(cache: ServerDataCache) {
    this.cache = cache;
  }

  router(): Router {
    const router = Router();
    router.get(ENDPOINTS.taxiStands.path, (req, res) => this.getTaxiStands(req, res));
    router.use((req, res) => {
      res.status(404).json({ error: `No such endpoint: ${req.originalUrl}` } satisfies ApiError);
    });
    return router;
  }

  getTaxiStands(req: Request, res: Response): void {
    const entry = this.cache.get("TAXI_STANDS");
    if (!entry) {
      res.status(503).json({ error: "Taxi stand data is not loaded yet" } satisfies ApiError);
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
