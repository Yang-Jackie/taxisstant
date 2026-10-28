import { z } from "zod";
import { Latitude, Longitude } from "./geo.js";

/** The design model's DensityLevel. */
export const DensityLevel = z.enum(["LOW", "MEDIUM", "HIGH"]).meta({ id: "DensityLevel" });
export type DensityLevel = z.infer<typeof DensityLevel>;

/** How crowded an MRT or LRT station's platforms were in the latest 10-minute slot LTA has published (FR-1.2.3, D20). */
export const HotspotDto = z
  .object({
    id: z.string().describe("The station, e.g. city-hall."),
    stationName: z.string().describe("e.g. City Hall."),
    codes: z.array(z.string()).min(1).describe("Every line's code for the station, e.g. EW13 and NS25."),
    latitude: Latitude,
    longitude: Longitude,
    density: DensityLevel.describe("The busiest platform's level, for interchange stations."),
    validFrom: z.iso.datetime().describe("Start of the 10-minute slot the level is for (UTC)."),
    validTo: z.iso
      .datetime()
      .describe(
        "End of that slot (UTC). LTA publishes a slot only after it ends, so this is usually 10–25 minutes ago.",
      ),
  })
  .meta({ id: "HotspotDto" });
export type HotspotDto = z.infer<typeof HotspotDto>;
