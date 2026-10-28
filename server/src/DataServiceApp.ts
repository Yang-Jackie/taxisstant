import { createHttpApp } from "./api/createHttpApp.js";
import { readConfig } from "./ServerConfig.js";
import { ServerDataCache } from "./cache/ServerDataCache.js";
import { ApiKeyStore } from "./external/ApiKeyStore.js";
import { ExternalApiFacade } from "./external/ExternalApiFacade.js";
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
import { SyncService } from "./sync/SyncService.js";

class DataServiceApp {
  static main(): void {
    const config = readConfig();
    const port = config.PORT;

    console.log(`Data service starting on port ${port}`);
    const cache = new ServerDataCache();
    const facade = new ExternalApiFacade(new ApiKeyStore());
    const strategies = [new PickupSuggestionStrategy(), new RestStopSuggestionStrategy()];
    const sync = new SyncService(
      facade,
      cache,
      [
        new TaxiStandAdapter(),
        new CarparkAdapter(),
        new HawkerCentreAdapter(),
        new FuelStationAdapter(),
        new ChargingStationAdapter(),
        new TaxiAdapter(),
        new CarparkAvailabilityAdapter(),
        new ChargerAvailabilityAdapter(),
        new HotspotAdapter(),
      ],
      60_000,
      strategies,
    );

    createHttpApp(cache, {
      corsOrigins: config.CORS_ORIGINS,
      trustProxy: config.TRUST_PROXY,
      rateLimitPerMinute: config.RATE_LIMIT_PER_MINUTE,
    }).listen(port, () => {
      console.log(`Data service listening on http://localhost:${port}`);
    });

    void sync.start(); // in the background: the server answers 503 until the first sync lands (D7)
  }
}

DataServiceApp.main();
