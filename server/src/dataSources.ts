import type { DatasetAdapter } from "./sync/DatasetAdapter.js";
import { CarparkAdapter } from "./sync/adapters/CarparkAdapter.js";
import { CarparkAvailabilityAdapter } from "./sync/adapters/CarparkAvailabilityAdapter.js";
import { ChargerAvailabilityAdapter } from "./sync/adapters/ChargerAvailabilityAdapter.js";
import { ChargingStationAdapter } from "./sync/adapters/ChargingStationAdapter.js";
import { FuelStationAdapter } from "./sync/adapters/FuelStationAdapter.js";
import { HawkerCentreAdapter } from "./sync/adapters/HawkerCentreAdapter.js";
import { HotspotAdapter } from "./sync/adapters/HotspotAdapter.js";
import { TaxiAdapter } from "./sync/adapters/TaxiAdapter.js";
import { TaxiStandAdapter } from "./sync/adapters/TaxiStandAdapter.js";
import { PickupSuggestionStrategy } from "./sync/strategies/PickupSuggestionStrategy.js";
import { RestStopSuggestionStrategy } from "./sync/strategies/RestStopSuggestionStrategy.js";
import type { SuggestionStrategy } from "./sync/strategies/SuggestionStrategy.js";

/** Every dataset the service fetches, each declaring its own source, paths and refresh interval (D21). */
export function createAdapters(): DatasetAdapter<unknown>[] {
  return [
    new TaxiStandAdapter(),
    new CarparkAdapter(),
    new HawkerCentreAdapter(),
    new FuelStationAdapter(),
    new ChargingStationAdapter(),
    new TaxiAdapter(),
    new CarparkAvailabilityAdapter(),
    new ChargerAvailabilityAdapter(),
    new HotspotAdapter(),
  ];
}

/** The suggested sites the service scores from those datasets: the design model's Strategy pattern (D28, D29). */
export function createStrategies(): SuggestionStrategy<unknown>[] {
  return [new PickupSuggestionStrategy(), new RestStopSuggestionStrategy()];
}
