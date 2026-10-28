import compression from "compression";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import type { ServerDataCache } from "../cache/ServerDataCache.js";
import { DataApiController } from "./DataApiController.js";

function logRequests(req: Request, res: Response, next: NextFunction): void {
  const started = Date.now();
  res.on("finish", () => {
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - started} ms)`);
  });
  next();
}

/** The HTTP side of the data service: request logging, gzip, and the API under /api. */
export function createHttpApp(cache: ServerDataCache, { log = true }: { log?: boolean } = {}): Express {
  const app = express();
  if (log) app.use(logRequests);
  app.use(compression()); // JSON shrinks about sevenfold: 785 kB of charging stations goes out as 115 kB
  app.use("/api", new DataApiController(cache).router());
  return app;
}
