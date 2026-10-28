import { z } from "zod";

/** How many car lots are free right now in one carpark (D19). Joins CarparkDto by id. */
export const CarparkAvailabilityDto = z
  .object({
    id: z.string().describe("The carpark's id, as in /carparks."),
    availableLots: z.number().int().min(0).describe("Free car lots, as LTA reports them."),
  })
  .meta({ id: "CarparkAvailabilityDto" });
export type CarparkAvailabilityDto = z.infer<typeof CarparkAvailabilityDto>;
