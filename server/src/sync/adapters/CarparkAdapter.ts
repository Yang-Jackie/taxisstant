import type { CarparkDto } from "@taxisstant/shared";
import { z } from "zod";
import type { Dataset } from "../../cache/Dataset.js";
import type { Provider } from "../../external/Provider.js";
import type { DatasetAdapter } from "../DatasetAdapter.js";
import { parseRows, uniqueBy } from "../parseRows.js";

/** One LTA availability row: a carpark and one of its lot types. Location is "latitude longitude". */
const LtaCarparkLot = z.object({
  CarParkID: z.string().min(1),
  Area: z.string(),
  Development: z.string().min(1),
  Location: z.string().regex(/^\s*-?\d+(\.\d+)?\s+-?\d+(\.\d+)?\s*$/, "expected 'latitude longitude'"),
  LotType: z.literal("C"),
  Agency: z.string().min(1),
});

/** More rows than this came twice: too many carparks were probably lost from the snapshot. */
const MAX_REPEATED_SHARE = 0.01;

/** Carparks come from LTA's availability feed, the only source that covers HDB, URA and LTA with coordinates. */
export class CarparkAdapter implements DatasetAdapter<CarparkDto[]> {
  getDataset(): Dataset {
    return "CARPARKS";
  }
  getSource(): Provider {
    return "LTA_DATAMALL";
  }
  getPath(): string {
    return "/CarParkAvailabilityv2";
  }
  getRefreshInterval(): number {
    return 24 * 60 * 60 * 1000; // daily: static data (D1)
  }

  prepare(raw: unknown): CarparkDto[] {
    const rows = z.array(z.looseObject({ CarParkID: z.unknown(), LotType: z.unknown() })).parse(raw);

    // LTA updates this feed while the facade reads its pages, so rows can shift between pages: some come twice and as
    // many are lost. A few lost carparks for a day is fine (duplicates are dropped below); many means a bad snapshot,
    // so reject it and let the sync retry, keeping the last good copy (D7).
    const keys = rows.map((row) => `${String(row.CarParkID)}|${String(row.LotType)}`);
    const repeats = keys.length - new Set(keys).size;
    if (repeats > rows.length * MAX_REPEATED_SHARE) {
      throw new Error(`${repeats} rows came twice: the feed changed while it was being read`);
    }
    if (repeats > 0) console.warn(`Carparks: ${repeats} rows came twice (the feed changed mid-read); kept one of each`);

    // Each carpark has one row per lot type; taxis only need car lots ("C"). Motorcycle and heavy-vehicle rows go.
    const carRows = rows.filter((row) => row.LotType === "C");
    const lots = parseRows(carRows, LtaCarparkLot, { minRows: 1000 });
    return uniqueBy(lots, (lot) => lot.CarParkID).map((lot) => {
      const [latitude, longitude] = lot.Location.trim().split(/\s+/).map(Number) as [number, number];
      return {
        id: lot.CarParkID,
        name: lot.Development,
        latitude,
        longitude,
        agency: lot.Agency,
        ...(lot.Area && { area: lot.Area }),
      };
    });
  }
}
