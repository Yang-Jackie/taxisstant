import { z } from "zod";
import { Latitude, Longitude } from "./geo.js";

/** A place with EV chargers (FR-1.1.3), from LTA. How many are free is live data (package 2c). */
export const ChargingStationDto = z
  .object({
    id: z.string().describe("Postal code and longitude, e.g. 179024:103.846728 (LTA gives locations no id)."),
    name: z.string().describe("e.g. CLARKE QUAY."),
    address: z.string(),
    latitude: Latitude,
    longitude: Longitude,
    operators: z.array(z.string()).min(1).describe("Who runs the chargers; a few places have several (D15)."),
    chargePoints: z.number().int().min(1).describe("How many chargers the place has."),
    maxPowerKw: z.number().positive().optional().describe("The fastest charger's power rating, in kW."),
    hasDcFast: z.boolean().describe("Whether any charger is DC: fast charging, from 30 kW up (D15)."),
    plugTypes: z.array(z.string()).describe('e.g. "Type 2", "Combo 2", "CHAdeMO".'),
  })
  .meta({ id: "ChargingStationDto" });
export type ChargingStationDto = z.infer<typeof ChargingStationDto>;
