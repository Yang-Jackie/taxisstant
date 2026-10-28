// Records fresh samples from the real providers (needs LTA_ACCOUNT_KEY in .env):
//   npm run record-samples -w server               every sample
//   npm run record-samples -w server -- carparks   just one
// Re-recording can change the counts some adapter tests expect; check `npm test -w server` afterwards.
// Carpark and charger availability read the same feeds as carparks and charging stations, so they share those samples.
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { ApiKeyStore } from "../external/ApiKeyStore.js";
import { ExternalApiFacade } from "../external/ExternalApiFacade.js";
import { CarparkAdapter } from "../sync/adapters/CarparkAdapter.js";
import { ChargingStationAdapter } from "../sync/adapters/ChargingStationAdapter.js";
import { FuelStationAdapter } from "../sync/adapters/FuelStationAdapter.js";
import { HawkerCentreAdapter } from "../sync/adapters/HawkerCentreAdapter.js";
import { HotspotAdapter } from "../sync/adapters/HotspotAdapter.js";
import { TaxiAdapter } from "../sync/adapters/TaxiAdapter.js";
import type { DatasetAdapter } from "../sync/DatasetAdapter.js";
import { SAMPLE_FILES, type SampleName } from "./samples.js";

const facade = new ExternalApiFacade(new ApiKeyStore(), fetch, 150_000);
const adapters: Record<SampleName, DatasetAdapter<unknown>> = {
  carparks: new CarparkAdapter(),
  chargingStations: new ChargingStationAdapter(),
  fuelStations: new FuelStationAdapter(),
  hawkerCentres: new HawkerCentreAdapter(),
  taxis: new TaxiAdapter(),
  hotspots: new HotspotAdapter(),
};

const only = process.argv.slice(2);
for (const [name, adapter] of Object.entries(adapters) as [SampleName, DatasetAdapter<unknown>][]) {
  if (only.length > 0 && !only.includes(name)) continue;
  for (let attempt = 1; ; attempt++) {
    try {
      const responses = await Promise.all(adapter.getPaths().map((path) => facade.fetch(adapter.getSource(), path)));
      adapter.prepare(responses); // never record something the adapter would reject
      const raw = responses.length === 1 ? responses[0] : responses; // a multi-path sample keeps every answer, in order
      const file = SAMPLE_FILES[name];
      const json = Buffer.from(JSON.stringify(raw));
      writeFileSync(new URL(file, import.meta.url), file.endsWith(".gz") ? gzipSync(json, { level: 9 }) : json);
      console.log(`${name}: wrote ${file}`);
      break;
    } catch (err) {
      if (attempt === 4) throw err;
      console.log(`${name}: attempt ${attempt} failed (${err instanceof Error ? err.message : String(err)}); retrying`);
      await new Promise((resolve) => setTimeout(resolve, attempt * 15_000)); // Overpass is often busy for a minute
    }
  }
}
