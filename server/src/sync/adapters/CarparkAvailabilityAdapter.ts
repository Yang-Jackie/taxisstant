import type { CarparkAvailabilityDto } from "@taxisstant/shared";
import type { Dataset } from "../../cache/Dataset.js";
import type { Provider } from "../../external/Provider.js";
import type { DatasetAdapter } from "../DatasetAdapter.js";
import { ltaCarLots } from "./CarparkAdapter.js";

/** Free car lots in every carpark, from the same LTA feed as the carpark list (D19). LTA updates it every minute. */
export class CarparkAvailabilityAdapter implements DatasetAdapter<CarparkAvailabilityDto[]> {
  getDataset(): Dataset {
    return "CARPARK_AVAILABILITY";
  }
  getSource(): Provider {
    return "LTA_DATAMALL";
  }
  getPaths(): readonly string[] {
    return ["/CarParkAvailabilityv2"];
  }
  getRefreshInterval(): number {
    return 60 * 1000; // live data: the diagram's 1–5 minutes, at LTA's own pace
  }

  prepare([raw]: readonly unknown[]): CarparkAvailabilityDto[] {
    return ltaCarLots(raw).map((lot) => ({ id: lot.CarParkID, availableLots: lot.AvailableLots }));
  }
}
