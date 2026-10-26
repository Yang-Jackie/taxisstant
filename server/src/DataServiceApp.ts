import express, { type NextFunction, type Request, type Response } from "express";  
import { readFileSync } from "node:fs";                                               
import { DataApiController } from "./DataApiController.js";                           
import { ServerDataCache } from "./ServerDataCache.js";

class DataServiceApp {
    static main(): void {
        const port = Number(process.env.PORT ?? "3000");

        if (!Number.isInteger(port) || port <= 0) {
            throw new Error(`PORT must be a positive whole number, got "${process.env.PORT}"`);
        }

        console.log(`Data service starting on port ${port}`);
        const cache = new ServerDataCache();                                               
        const sampleStands: unknown = JSON.parse(                                          
            readFileSync(new URL("./sample-data/taxi-stands.json", import.meta.url), "utf8"),
        );
        cache.put("TAXI_STANDS", sampleStands);                                            

        const app = express();                                                             
        app.use(DataServiceApp.logRequests);                                               
        app.use("/api", new DataApiController(cache).router());                            

        app.listen(port, () => {                                                           
            console.log(`Data service listening on http://localhost:${port}`);
        });
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
