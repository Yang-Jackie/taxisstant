import type { TaxiDto } from "@taxisstant/shared";
import { z } from "zod";
import type { Dataset } from "../../cache/Dataset.js";
import type { Provider } from "../../external/Provider.js";
import type { DatasetAdapter } from "../DatasetAdapter.js";
import { parseRows } from "../parseRows.js";

/** data.gov.sg's answer: one GeoJSON feature whose MultiPoint holds every available taxi, all from one snapshot. */
const TaxiAvailability = z.object({
  features: z
    .array(z.object({ geometry: z.object({ type: z.literal("MultiPoint"), coordinates: z.unknown() }) }))
    .length(1),
});

/** One taxi, as GeoJSON writes it: [longitude, latitude], somewhere around Singapore. */
const Position = z.tuple([z.number().min(103.5).max(104.2), z.number().min(1.1).max(1.5)]);

/** Five decimals is about a metre: plenty for a map, and it keeps the response small. */
const round = (degrees: number) => Math.round(degrees * 1e5) / 1e5;

/** Available taxis (FR-1.2.2), from data.gov.sg as the deployment diagram says: one request, no paging. */
export class TaxiAdapter implements DatasetAdapter<TaxiDto[]> {
  getDataset(): Dataset {
    return "TAXIS";
  }
  getSource(): Provider {
    return "DATA_GOV_SG";
  }
  getPaths(): readonly string[] {
    return ["/v1/transport/taxi-availability"];
  }
  getRefreshInterval(): number {
    return 30 * 1000; // the deployment diagram's 30 s
  }

  prepare([raw]: readonly unknown[]): TaxiDto[] {
    const [feature] = TaxiAvailability.parse(raw).features;
    return parseRows(feature!.geometry.coordinates, Position, { minRows: 100 }).map(([longitude, latitude]) => ({
      latitude: round(latitude),
      longitude: round(longitude),
    }));
  }
}
