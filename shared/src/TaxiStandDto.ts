import { z } from "zod";
import { Latitude, Longitude } from "./geo.js";

/** A taxi stand as the server sends it and the client receives it (plain JSON, no methods). */
export const TaxiStandDto = z
  .object({
    id: z.string().describe("LTA's taxi stand code, e.g. A01."),
    name: z.string().describe("Where it is, e.g. Orchard Rd along driveway of Lucky Plaza."),
    latitude: Latitude,
    longitude: Longitude,
    standType: z.string().describe('LTA\'s type, e.g. "Stand" or "Stop".'),
    isBarrierFree: z.boolean().describe("Whether it has barrier-free access."),
  })
  .meta({ id: "TaxiStandDto" });
export type TaxiStandDto = z.infer<typeof TaxiStandDto>;
