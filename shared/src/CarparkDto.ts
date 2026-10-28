import { z } from "zod";
import { Latitude, Longitude } from "./geo.js";

/** A carpark with car lots, run by HDB, URA or LTA (FR-1.1.2). How many lots are free is live data (package 2c). */
export const CarparkDto = z
  .object({
    id: z.string().describe("LTA's carpark ID, e.g. A2. For HDB carparks this is the HDB carpark number."),
    name: z.string().describe("The development or block, e.g. BLK 206/207 ANG MO KIO STREET 22."),
    latitude: Latitude,
    longitude: Longitude,
    agency: z.string().describe('Who runs it: "HDB", "URA" or "LTA".'),
    area: z.string().optional().describe('LTA\'s area for its own carparks, e.g. "Orchard".'),
  })
  .meta({ id: "CarparkDto" });
export type CarparkDto = z.infer<typeof CarparkDto>;
