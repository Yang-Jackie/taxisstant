import { z } from "zod";
import { Latitude, Longitude } from "./geo.js";

/** A petrol station (FR-1.1.3), from OpenStreetMap (D12). Data © OpenStreetMap contributors, ODbL. */
export const FuelStationDto = z
  .object({
    id: z.string().describe('The OpenStreetMap element, e.g. "way/123456".'),
    name: z.string().describe('e.g. "Shell Dunearn"; "Fuel station" when OpenStreetMap has no name.'),
    brand: z.string().optional().describe('e.g. "Shell", "Esso", "Caltex", "SPC"; missing when unknown.'),
    latitude: Latitude,
    longitude: Longitude,
    address: z.string().optional(),
    openingHours: z.string().optional().describe('In OpenStreetMap\'s opening_hours format, e.g. "24/7", where known.'),
  })
  .meta({ id: "FuelStationDto" });
export type FuelStationDto = z.infer<typeof FuelStationDto>;
