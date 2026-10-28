// Real provider responses, recorded by record.ts exactly as ExternalApiFacade returns them, for tests.
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

/** Each sample's file. Files over ~200 kB are gzipped. */
export const SAMPLE_FILES = {
  carparks: "lta-carparks.json.gz",
  chargingStations: "lta-ev-batch.json.gz",
  fuelStations: "osm-fuel-stations.json",
  hawkerCentres: "nea-hawker-centres.json",
  taxis: "datagovsg-taxis.json",
  /** One answer per train line, in TRAIN_LINES order (D21). */
  hotspots: "lta-crowd-realtime.json",
} as const;
export type SampleName = keyof typeof SAMPLE_FILES;

export function loadSample(name: SampleName): unknown {
  const file = SAMPLE_FILES[name];
  const bytes = readFileSync(new URL(file, import.meta.url));
  return JSON.parse((file.endsWith(".gz") ? gunzipSync(bytes) : bytes).toString("utf8"));
}
