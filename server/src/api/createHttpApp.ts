import type { ApiError } from "@taxisstant/shared";
import compression from "compression";
import cors from "cors";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import type { ServerDataCache } from "../cache/ServerDataCache.js";
import { DataApiController } from "./DataApiController.js";

export interface HttpOptions {
  log?: boolean;
  /** Browser origins allowed to call the API from another site; none means same-origin only (D27). */
  corsOrigins?: readonly string[];
  /** How many proxies sit in front, so `req.ip` is the client's own address (0: none). */
  trustProxy?: number;
  /** Requests each client address may make per minute (D27). */
  rateLimitPerMinute?: number;
}

function logRequests(req: Request, res: Response, next: NextFunction): void {
  const started = Date.now();
  res.on("finish", () => {
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - started} ms)`);
  });
  next();
}

/** The HTTP side of the data service: logging, gzip, CORS, a rate limit, and the API under /api. */
export function createHttpApp(
  cache: ServerDataCache,
  { log = true, corsOrigins = [], trustProxy = 0, rateLimitPerMinute = 300 }: HttpOptions = {},
): Express {
  const app = express();
  app.disable("x-powered-by"); // don't advertise the framework
  if (trustProxy > 0) app.set("trust proxy", trustProxy);
  if (log) app.use(logRequests);
  app.use(compression()); // JSON shrinks about sevenfold: 785 kB of charging stations goes out as 115 kB

  const api = express.Router();
  // CORS first, so even a 429 is readable by an allowed site. With no origins listed, no CORS headers are sent at all.
  if (corsOrigins.length > 0) {
    api.use(
      cors({
        origin: [...corsOrigins],
        methods: ["GET"],
        allowedHeaders: ["If-None-Match"], // the client's ETag re-check (it makes browsers ask first: a preflight)
        exposedHeaders: ["ETag"],
        maxAge: 600,
      }),
    );
  }
  api.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: rateLimitPerMinute,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      handler: (_req, res) => {
        res.status(429).json({ error: "Too many requests. Please try again in a minute." } satisfies ApiError);
      },
    }),
  );
  api.use(new DataApiController(cache).router());
  app.use("/api", api);
  return app;
}
