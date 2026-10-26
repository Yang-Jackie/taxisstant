import { Router, type Request, type Response } from "express";
import type { ServerDataCache } from "./ServerDataCache.js";

export class DataApiController {
  private readonly cache: ServerDataCache;

  constructor(cache: ServerDataCache) {
    this.cache = cache;
  }

  router(): Router {
    const router = Router();
    router.get("/taxi-stands", (req, res) => this.getTaxiStands(req, res));
    router.use((req, res) => {
      res.status(404).json({ error: `No such endpoint: ${req.originalUrl}` });
    });
    return router;
  }

  getTaxiStands(req: Request, res: Response): void {
    const entry = this.cache.get("TAXI_STANDS");
    if (!entry) {
      res.status(503).json({ error: "Taxi stand data is not loaded yet" });
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
