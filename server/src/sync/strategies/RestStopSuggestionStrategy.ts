import {
  AVAILABILITY_MAX_AGE_MS,
  CarparkAvailabilityDto,
  CarparkDto,
  ChargerAvailabilityDto,
  ChargingStationDto,
  FuelStationDto,
  HawkerCentreDto,
  type SuggestedRestStopDto,
} from "@taxisstant/shared";
import { z } from "zod";
import type { Dataset } from "../../cache/Dataset.js";
import type { ServerDataCache } from "../../cache/ServerDataCache.js";
import { metresBetween } from "../geo.js";
import { singaporeDate } from "../singaporeDate.js";
import { cached, type SuggestionStrategy } from "./SuggestionStrategy.js";

/** Amenities this close to a hawker centre make it a better rest stop. */
const AMENITY_RADIUS_M = 500;
/** A centre with this many cooked-food stalls offers full choice. */
const FULL_CHOICE_STALLS = 60;
/** A carpark with this many free lots has plenty of space. */
const PLENTY_OF_LOTS = 50;

const near = (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) =>
  metresBetween({ lat: a.latitude, lon: a.longitude }, { lat: b.latitude, lon: b.longitude }) <= AMENITY_RADIUS_M;

/** Live figures by id, or undefined when they're missing or too old to trust (D22). */
function liveById<T extends { id: string }>(
  cache: ServerDataCache,
  dataset: Dataset,
  schema: z.ZodType<T[]>,
  value: (item: T) => number,
  now: Date,
): ReadonlyMap<string, number> | undefined {
  const items = cached(cache, dataset, schema, { maxAgeMs: AVAILABILITY_MAX_AGE_MS, now });
  return items && new Map(items.map((i) => [i.id, value(i)]));
}

/** Hawker centres scored for a rest stop (UC 0008): food, parking, and which energy stops are near (D29). */
export class RestStopSuggestionStrategy implements SuggestionStrategy<SuggestedRestStopDto[]> {
  getDataset(): Dataset {
    return "REST_STOP_SITES";
  }

  getInputs(): readonly Dataset[] {
    return [
      "HAWKER_CENTRES",
      "CARPARKS",
      "CARPARK_AVAILABILITY",
      "FUEL_STATIONS",
      "CHARGING_STATIONS",
      "CHARGER_AVAILABILITY",
    ];
  }

  buildSites(cache: ServerDataCache, now: Date): SuggestedRestStopDto[] | undefined {
    const centres = cached(cache, "HAWKER_CENTRES", z.array(HawkerCentreDto));
    if (!centres) return undefined;
    const carparks = cached(cache, "CARPARKS", z.array(CarparkDto)) ?? [];
    const lots = liveById(cache, "CARPARK_AVAILABILITY", z.array(CarparkAvailabilityDto), (a) => a.availableLots, now);
    const fuel = cached(cache, "FUEL_STATIONS", z.array(FuelStationDto)) ?? [];
    const chargers = cached(cache, "CHARGING_STATIONS", z.array(ChargingStationDto)) ?? [];
    const points = liveById(
      cache,
      "CHARGER_AVAILABILITY",
      z.array(ChargerAvailabilityDto),
      (a) => a.availablePoints,
      now,
    );

    const today = singaporeDate(now);
    // A rest stop needs food: leave out centres closed today (D13), and wet markets with no cooked-food stalls
    const openToday = centres.filter(
      (c) => c.foodStalls > 0 && !c.closures.some((cl) => cl.from <= today && today <= cl.to),
    );

    return openToday
      .map((centre): SuggestedRestStopDto => {
        // Each nearby carpark counts by its free lots when known (50 or more is plenty), or half when not; the best counts
        const nearCarparks = carparks.filter((c) => near(centre, c));
        const known = nearCarparks.flatMap((c) => (lots?.has(c.id) ? [lots.get(c.id)!] : []));
        const freeLots = known.length > 0 ? Math.max(...known) : undefined;
        const parking = Math.max(
          0,
          ...nearCarparks.map((c) => (lots?.has(c.id) ? Math.min(1, lots.get(c.id)! / PLENTY_OF_LOTS) : 0.5)),
        );

        const nearChargers = chargers.filter((c) => near(centre, c));
        const knownPoints = nearChargers.flatMap((c) => (points?.has(c.id) ? [points.get(c.id)!] : []));
        const freeChargePoints = knownPoints.length > 0 ? knownPoints.reduce((n, p) => n + p, 0) : undefined;
        const hasFuel = fuel.some((f) => near(centre, f));
        const hasCharging = nearChargers.length > 0;

        const parkingSaid =
          freeLots !== undefined && freeLots > 0 ? `parking (${freeLots} free)` : parking > 0 ? "parking" : undefined;
        const chargingSaid = hasCharging
          ? freeChargePoints !== undefined
            ? `EV charging (${freeChargePoints} free)`
            : "EV charging"
          : undefined;
        return {
          id: centre.id,
          name: centre.name,
          latitude: centre.latitude,
          longitude: centre.longitude,
          radius: AMENITY_RADIUS_M,
          score: this.calculateAmenities({ foodStalls: centre.foodStalls, parking }),
          summary: [`Food (${centre.foodStalls} stalls)`, parkingSaid, hasFuel ? "fuel" : undefined, chargingSaid]
            .filter(Boolean)
            .join(" · "),
          foodStalls: centre.foodStalls,
          hasParking: parking > 0,
          ...(freeLots !== undefined && { freeLots }),
          hasFuel,
          hasCharging,
          ...(freeChargePoints !== undefined && { freeChargePoints }),
        };
      })
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  }

  /**
   * The design model's calculateAmenities: half for food choice, half for parking (D29). Fuel and charging aren't
   * scored here; the client matches them to the driver's vehicle type (FR-2.1.1).
   */
  private calculateAmenities(s: { foodStalls: number; parking: number }): number {
    return 0.5 * Math.min(1, s.foodStalls / FULL_CHOICE_STALLS) + 0.5 * s.parking;
  }
}
