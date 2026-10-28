import type { FuelStationDto } from "@taxisstant/shared";
import { z } from "zod";
import type { Dataset } from "../../cache/Dataset.js";
import type { Provider } from "../../external/Provider.js";
import type { DatasetAdapter } from "../DatasetAdapter.js";
import { metresBetween } from "../geo.js";
import { parseRows } from "../parseRows.js";

/** One OpenStreetMap element tagged amenity=fuel. Ways and relations come with a centre point (`out center`). */
const OsmFuel = z
  .object({
    type: z.enum(["node", "way", "relation"]),
    id: z.number().int(),
    lat: z.number().optional(),
    lon: z.number().optional(),
    center: z.object({ lat: z.number(), lon: z.number() }).optional(),
    tags: z.record(z.string(), z.string()).default({}),
  })
  .refine((e) => (e.lat !== undefined && e.lon !== undefined) || e.center, "no position");
type OsmFuel = z.infer<typeof OsmFuel>;

/** Singapore's petrol brands, as we spell them. OpenStreetMap writes some differently ("ESSO", "Sinopec Singapore"). */
const BRANDS = ["Shell", "Esso", "Caltex", "SPC", "Sinopec", "Cnergy", "Smart Energy"];

/** The brand from the brand tag, else from the operator or the name ("SPC Bukit Batok Service Station"). */
export function brandOf(tags: Record<string, string>): string | undefined {
  for (const text of [tags.brand, tags.operator, tags.name]) {
    const known = BRANDS.find((b) => new RegExp(`\\b${b}\\b`, "i").test(text ?? ""));
    if (known) return known;
  }
  return tags.brand;
}

/** OpenStreetMap often maps one station twice (the shop and its canopy); closer than this counts as the same one. */
const SAME_STATION_METRES = 50;

const positionOf = (e: OsmFuel) => e.center ?? { lat: e.lat!, lon: e.lon! };
const isPublic = (e: OsmFuel) => !["private", "no"].includes(e.tags.access ?? "");
const richness = (e: OsmFuel) => (e.tags.name ? 100 : 0) + (brandOf(e.tags) ? 10 : 0) + Object.keys(e.tags).length;

/** Petrol stations from OpenStreetMap, the only source that lists them (D12). */
export class FuelStationAdapter implements DatasetAdapter<FuelStationDto[]> {
  getDataset(): Dataset {
    return "FUEL_STATIONS";
  }
  getSource(): Provider {
    return "OSM_OVERPASS";
  }
  getPath(): string {
    return '[out:json][timeout:90];area["ISO3166-1"="SG"][admin_level=2]->.sg;nwr["amenity"="fuel"](area.sg);out center tags;';
  }
  getRefreshInterval(): number {
    return 24 * 60 * 60 * 1000; // daily: static data (D1)
  }

  prepare(raw: unknown): FuelStationDto[] {
    const { elements } = z.object({ elements: z.unknown() }).parse(raw);
    const all = parseRows(elements, OsmFuel, { minRows: 100 }).filter(isPublic);

    // Keep the best-described element of each station: drop one that lies next to a kept one whose brand doesn't differ.
    const kept: OsmFuel[] = [];
    for (const e of [...all].sort((a, b) => richness(b) - richness(a))) {
      const brand = brandOf(e.tags);
      const duplicate = kept.some((k) => {
        const other = brandOf(k.tags);
        const sameBrand = !brand || !other || brand === other;
        return sameBrand && metresBetween(positionOf(e), positionOf(k)) < SAME_STATION_METRES;
      });
      if (!duplicate) kept.push(e);
    }

    return kept.map((e) => {
      const { lat, lon } = positionOf(e);
      const brand = brandOf(e.tags);
      const street = [e.tags["addr:housenumber"], e.tags["addr:street"]].filter(Boolean).join(" ");
      return {
        id: `${e.type}/${e.id}`,
        name: e.tags["name:en"] ?? e.tags.name ?? brand ?? "Fuel station",
        ...(brand && { brand }),
        latitude: lat,
        longitude: lon,
        ...(street && { address: [street, e.tags["addr:postcode"]].filter(Boolean).join(", Singapore ") }),
        ...(e.tags.opening_hours && { openingHours: e.tags.opening_hours }),
      };
    });
  }
}
