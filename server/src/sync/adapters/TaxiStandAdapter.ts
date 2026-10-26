import { z } from "zod";
import type { Dataset } from "../../cache/Dataset.js";
import type { TaxiStandDto } from "../../contract/TaxiStandDto.js";
import type { Provider } from "../../external/Provider.js";
import type { DatasetAdapter } from "../DatasetAdapter.js";


/** What one LTA taxi-stand row must look like. Anything else is rejected. */
const LtaTaxiStand = z.object({
  TaxiCode: z.string(),
  Name: z.string(),
  Latitude: z.number(),
  Longitude: z.number(),
  Type: z.string(),
  Bfa: z.enum(["Yes", "No"]),
});

export class TaxiStandAdapter implements DatasetAdapter<TaxiStandDto[]> {
  getDataset(): Dataset { return "TAXI_STANDS"; }
  getSource(): Provider { return "LTA_DATAMALL"; }
  getPath(): string { return "/TaxiStands"; }
  getRefreshInterval(): number { return 24 * 60 * 60 * 1000; } // daily: static data (D1)

  prepare(raw: unknown): TaxiStandDto[] {
    return z.array(LtaTaxiStand).parse(raw).map((row) => ({
      id: row.TaxiCode,
      name: row.Name,
      latitude: row.Latitude,
      longitude: row.Longitude,
      standType: row.Type,
      isBarrierFree: row.Bfa === "Yes",
    }));
  }
}
