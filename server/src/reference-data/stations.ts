// The MRT and LRT stations' positions (D14): a committed file, so the server never needs OneMap or its token.
// Rebuilt by build-stations.ts when a line opens.
import { readFileSync } from "node:fs";
import { z } from "zod";

export const Station = z.object({
  id: z.string().min(1).describe("Made from the name, e.g. city-hall."),
  name: z.string().min(1),
  codes: z.array(z.string().min(1)).min(1).describe("Every line's code for this station, e.g. EW13 and NS25."),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
export type Station = z.infer<typeof Station>;

export const StationsFile = z.object({
  generatedOn: z.iso.date(),
  stations: z.array(Station).min(100),
});

/** Every station, by each of its codes. Reads and checks the committed file. */
export function loadStations(file = new URL("train-stations.json", import.meta.url)): ReadonlyMap<string, Station> {
  const { stations } = StationsFile.parse(JSON.parse(readFileSync(file, "utf8")));
  return new Map(stations.flatMap((s) => s.codes.map((code) => [code, s] as const)));
}
