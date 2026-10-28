import { z } from "zod";

/** How many chargers are free right now at one place (the design model's availablePoints). Joins ChargingStationDto by id. */
export const ChargerAvailabilityDto = z
  .object({
    id: z.string().describe("The place's id, as in /charging-stations."),
    availablePoints: z
      .number()
      .int()
      .min(0)
      .describe("Chargers LTA reports as available; occupied and out-of-service ones don't count."),
  })
  .meta({ id: "ChargerAvailabilityDto" });
export type ChargerAvailabilityDto = z.infer<typeof ChargerAvailabilityDto>;
