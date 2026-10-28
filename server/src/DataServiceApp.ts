import express, { type NextFunction, type Request, type Response } from "express";
import { DataApiController } from "./api/DataApiController.js";
import { ServerDataCache } from "./cache/ServerDataCache.js";
import { ApiKeyStore } from "./external/ApiKeyStore.js";
import { ExternalApiFacade } from "./external/ExternalApiFacade.js";
import { TaxiStandAdapter } from "./sync/adapters/TaxiStandAdapter.js";
import { SyncService } from "./sync/SyncService.js";

class DataServiceApp {
  static main(): void {
    const port = Number(process.env.PORT ?? "3000");

    if (!Number.isInteger(port) || port <= 0) {
      throw new Error(`PORT must be a positive whole number, got "${process.env.PORT}"`);
    }

    console.log(`Data service starting on port ${port}`);
    const cache = new ServerDataCache();
    const facade = new ExternalApiFacade(new ApiKeyStore());
    const sync = new SyncService(facade, cache, [new TaxiStandAdapter()]);

    const app = express();
    app.use(DataServiceApp.logRequests);
    app.use("/api", new DataApiController(cache).router());

    app.listen(port, () => {
      console.log(`Data service listening on http://localhost:${port}`);
    });

    void sync.start(); // in the background: the server answers 503 until the first sync lands (D7)
  }

  private static logRequests(req: Request, res: Response, next: NextFunction): void {
    const started = Date.now();
    res.on("finish", () => {
      console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - started} ms)`);
    });
    next();
  }
}

DataServiceApp.main();
