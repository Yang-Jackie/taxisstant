import { z } from "zod";

/** A taxi stand as the server sends it and the client receives it (plain JSON, no methods). */
export const TaxiStandDto = z
  .object({
    id: z.string().describe("LTA's taxi stand code, e.g. A01."),
    name: z.string().describe("Where it is, e.g. Orchard Rd along driveway of Lucky Plaza."),
    latitude: z.number().min(-90).max(90).describe("WGS 84 degrees."),
    longitude: z.number().min(-180).max(180).describe("WGS 84 degrees."),
    standType: z.string().describe('LTA\'s type, e.g. "Stand" or "Stop".'),
    isBarrierFree: z.boolean().describe("Whether it has barrier-free access."),
  })
  .meta({ id: "TaxiStandDto" });
export type TaxiStandDto = z.infer<typeof TaxiStandDto>;
