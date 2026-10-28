import type { ChargerAvailabilityDto } from "@taxisstant/shared";
import { z } from "zod";
import type { Dataset } from "../../cache/Dataset.js";
import type { Provider } from "../../external/Provider.js";
import type { DatasetAdapter } from "../DatasetAdapter.js";
import { parseRows, uniqueBy } from "../parseRows.js";
import { chargingStationId } from "./ChargingStationAdapter.js";

/** LTA's charger status: "1" available, "0" occupied, "100" out of service; sometimes empty (unknown). */
const AVAILABLE = "1";

const LtaEvStatus = z.object({
  postalCode: z.string().trim().min(1),
  longtitude: z.number(), // sic: LTA's spelling
  chargingPoints: z.array(z.object({ status: z.string() })).min(1),
});

/** Free chargers per place, from the same LTA batch file as the charging stations. LTA updates it every 5 minutes. */
export class ChargerAvailabilityAdapter implements DatasetAdapter<ChargerAvailabilityDto[]> {
  getDataset(): Dataset {
    return "CHARGER_AVAILABILITY";
  }
  getSource(): Provider {
    return "LTA_DATAMALL";
  }
  getPaths(): readonly string[] {
    return ["/EVCBatch"];
  }
  getRefreshInterval(): number {
    return 5 * 60 * 1000; // live data: the diagram's 1–5 minutes, at LTA's own pace
  }

  prepare([raw]: readonly unknown[]): ChargerAvailabilityDto[] {
    const { evLocationsData } = z.object({ evLocationsData: z.unknown() }).parse(raw);
    const places = parseRows(evLocationsData, LtaEvStatus, { minRows: 1000 }).map((l) => ({
      id: chargingStationId(l.postalCode, l.longtitude),
      availablePoints: l.chargingPoints.filter((c) => c.status === AVAILABLE).length,
    }));
    return uniqueBy(places, (p) => p.id);
  }
}
