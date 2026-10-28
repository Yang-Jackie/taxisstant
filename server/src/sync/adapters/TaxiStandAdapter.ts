import { z } from "zod";
import type { Dataset } from "../../cache/Dataset.js";
import type { TaxiStandDto } from "@taxisstant/shared";
import type { Provider } from "../../external/Provider.js";
import type { DatasetAdapter } from "../DatasetAdapter.js";
import { parseRows, uniqueBy } from "../parseRows.js";

/** What one LTA taxi-stand row must look like. A row that doesn't fit is skipped (D16). */
const LtaTaxiStand = z.object({
  TaxiCode: z.string(),
  Name: z.string(),
  Latitude: z.number(),
  Longitude: z.number(),
  Type: z.string(),
  Bfa: z.enum(["Yes", "No"]),
});

export class TaxiStandAdapter implements DatasetAdapter<TaxiStandDto[]> {
  getDataset(): Dataset {
    return "TAXI_STANDS";
  }
  getSource(): Provider {
    return "LTA_DATAMALL";
  }
  getPaths(): readonly string[] {
    return ["/TaxiStands"];
  }
  getRefreshInterval(): number {
    return 24 * 60 * 60 * 1000;
  } // daily: static data (D1)

  prepare([raw]: readonly unknown[]): TaxiStandDto[] {
    const stands = uniqueBy(parseRows(raw, LtaTaxiStand, { minRows: 200 }), (row) => row.TaxiCode);
    return stands.map((row) => ({
      id: row.TaxiCode,
      name: row.Name,
      latitude: row.Latitude,
      longitude: row.Longitude,
      standType: row.Type,
      isBarrierFree: row.Bfa === "Yes",
    }));
  }
}
