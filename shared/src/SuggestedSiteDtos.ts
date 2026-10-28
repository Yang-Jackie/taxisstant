import { z } from "zod";
import { Latitude, Longitude } from "./geo.js";
import { DensityLevel } from "./HotspotDto.js";

/** What every suggested site has: the design model's Site (centre, radius) and SuggestedSite (score, summary). */
const SuggestedSite = z.object({
  id: z.string().describe("The site's landmark: a taxi stand's or a hawker centre's id."),
  name: z.string(),
  latitude: Latitude,
  longitude: Longitude,
  radius: z.number().positive().describe("The area the score looked at, in metres."),
  score: z.number().min(0).max(1).describe("How good the site is, from 0 to 1. The client ranks by this and distance."),
  summary: z.string().describe('Why, in a few words, e.g. "City Hall very crowded · 3 empty taxis nearby".'),
});

/** A taxi stand scored for picking up passengers (UC 0009, D28): busy stations nearby, few empty taxis competing. */
export const SuggestedPickupDto = SuggestedSite.extend({
  taxiCount: z.number().int().min(0).describe("Empty taxis within 300 m: the competition."),
  crowdDensity: DensityLevel.optional().describe("The busiest station within 500 m; missing when none is near."),
  stationName: z.string().optional().describe("That station."),
}).meta({ id: "SuggestedPickupDto" });
export type SuggestedPickupDto = z.infer<typeof SuggestedPickupDto>;

/** A hawker centre scored for a rest stop (UC 0008, D29): food, parking, and which energy stops are near. */
export const SuggestedRestStopDto = SuggestedSite.extend({
  foodStalls: z.number().int().min(0).describe("Cooked-food stalls: the choice of food."),
  hasParking: z.boolean().describe("A carpark within 500 m with free lots, or whose free lots aren't known."),
  freeLots: z.number().int().min(0).optional().describe("Free lots in the best carpark within 500 m, when known."),
  hasFuel: z.boolean().describe("A petrol station within 500 m."),
  hasCharging: z.boolean().describe("EV chargers within 500 m."),
  freeChargePoints: z.number().int().min(0).optional().describe("Free chargers within 500 m, when known."),
}).meta({ id: "SuggestedRestStopDto" });
export type SuggestedRestStopDto = z.infer<typeof SuggestedRestStopDto>;
