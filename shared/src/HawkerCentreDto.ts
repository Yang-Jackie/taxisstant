import { z } from "zod";
import { Latitude, Longitude } from "./geo.js";

/** A day range when a hawker centre is closed, as NEA publishes it (D13). */
export const HawkerClosure = z
  .object({
    from: z.iso.date().describe("The first day closed (Singapore date)."),
    to: z.iso.date().describe("The last day closed, inclusive."),
    reason: z.enum(["cleaning", "works"]).describe("Quarterly cleaning, or other works such as repairs."),
    remarks: z.string().optional().describe('NEA\'s note, e.g. "Repairs and Redecoration".'),
  })
  .meta({ id: "HawkerClosure" });
export type HawkerClosure = z.infer<typeof HawkerClosure>;

/** A hawker centre (FR-1.1.1). It has no opening hours of its own; its stalls do (D13). */
export const HawkerCentreDto = z
  .object({
    id: z.string().describe("Made from the name, e.g. adam-road-food-centre (NEA gives no stable id)."),
    name: z.string().describe("e.g. Adam Road Food Centre."),
    address: z.string(),
    latitude: Latitude,
    longitude: Longitude,
    foodStalls: z.number().int().min(0).describe("Cooked food stalls."),
    marketStalls: z.number().int().min(0).describe("Market (wet and dry goods) stalls."),
    closures: z
      .array(HawkerClosure)
      .describe('This year\'s closures. Ones NEA lists as "TBC" are left out until dated.'),
  })
  .meta({ id: "HawkerCentreDto" });
export type HawkerCentreDto = z.infer<typeof HawkerCentreDto>;
