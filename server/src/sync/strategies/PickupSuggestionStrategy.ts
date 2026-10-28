import {
  HOTSPOT_MAX_LAG_MS,
  HotspotDto,
  TAXI_MAX_AGE_MS,
  TaxiDto,
  TaxiStandDto,
  type DensityLevel,
  type SuggestedPickupDto,
} from "@taxisstant/shared";
import { z } from "zod";
import type { Dataset } from "../../cache/Dataset.js";
import type { ServerDataCache } from "../../cache/ServerDataCache.js";
import { metresBetween } from "../geo.js";
import { cached, type SuggestionStrategy } from "./SuggestionStrategy.js";

/** A station this close to a stand brings it passengers. */
const CROWD_RADIUS_M = 500;
/** Empty taxis this close to a stand compete for its passengers. */
const TAXI_RADIUS_M = 300;
/** Each this many empty taxis nearby add one more share of competition (D28). */
const TAXIS_PER_COMPETITOR = 5;

/** How much demand a station's crowd level brings (D28). A stand with no station near still sees some. */
const DEMAND: Record<DensityLevel, number> = { HIGH: 1, MEDIUM: 0.6, LOW: 0.25 };
const DEMAND_WITHOUT_STATION = 0.1;
const RANK: Record<DensityLevel, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };
const CROWD_WORDS: Record<DensityLevel, string> = { HIGH: "very crowded", MEDIUM: "crowded", LOW: "quiet" };

const near = (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }, metres: number) =>
  metresBetween({ lat: a.latitude, lon: a.longitude }, { lat: b.latitude, lon: b.longitude }) <= metres;

/** Taxi stands scored for picking up passengers (UC 0009): busy stations nearby, few empty taxis competing (D28). */
export class PickupSuggestionStrategy implements SuggestionStrategy<SuggestedPickupDto[]> {
  getDataset(): Dataset {
    return "PICKUP_SITES";
  }

  getInputs(): readonly Dataset[] {
    return ["TAXI_STANDS", "TAXIS", "HOTSPOTS"];
  }

  buildSites(cache: ServerDataCache, now: Date): SuggestedPickupDto[] | undefined {
    const stands = cached(cache, "TAXI_STANDS", z.array(TaxiStandDto));
    if (!stands) return undefined;
    // Live data counts only while it is recent enough (D22): an old crowd level or old taxi positions would mislead
    const taxis = cached(cache, "TAXIS", z.array(TaxiDto), { maxAgeMs: TAXI_MAX_AGE_MS, now }) ?? [];
    const hotspots = (cached(cache, "HOTSPOTS", z.array(HotspotDto)) ?? []).filter(
      (h) => now.getTime() - Date.parse(h.validTo) <= HOTSPOT_MAX_LAG_MS,
    );

    return stands
      .map((stand): SuggestedPickupDto => {
        const station = hotspots
          .filter((h) => near(stand, h, CROWD_RADIUS_M))
          .sort((a, b) => RANK[b.density] - RANK[a.density])[0];
        const taxiCount = taxis.filter((t) => near(stand, t, TAXI_RADIUS_M)).length;
        const taxisSaid =
          taxiCount === 0 ? "no empty taxis nearby" : `${taxiCount} empty ${taxiCount === 1 ? "taxi" : "taxis"} nearby`;
        return {
          id: stand.id,
          name: stand.name,
          latitude: stand.latitude,
          longitude: stand.longitude,
          radius: TAXI_RADIUS_M,
          score: this.calculateProbability({ crowdDensity: station?.density, taxiCount }),
          summary: [
            station ? `${station.stationName} ${CROWD_WORDS[station.density]}` : "No station nearby",
            taxisSaid,
          ].join(" · "),
          taxiCount,
          ...(station && { crowdDensity: station.density, stationName: station.stationName }),
        };
      })
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  }

  /** The design model's calculateProbability: demand from the crowd, shared among the empty taxis already there. */
  private calculateProbability(s: { crowdDensity?: DensityLevel; taxiCount: number }): number {
    const demand = s.crowdDensity ? DEMAND[s.crowdDensity] : DEMAND_WITHOUT_STATION;
    return demand / (1 + s.taxiCount / TAXIS_PER_COMPETITOR);
  }
}
