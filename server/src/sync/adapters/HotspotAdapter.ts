import type { DensityLevel, HotspotDto } from "@taxisstant/shared";
import { z } from "zod";
import type { Dataset } from "../../cache/Dataset.js";
import type { Provider } from "../../external/Provider.js";
import { loadStations, type Station } from "../../reference-data/stations.js";
import type { DatasetAdapter } from "../DatasetAdapter.js";
import { parseRows } from "../parseRows.js";

/** LTA's train lines, as its crowd API names them; it takes one per request (D21). */
export const TRAIN_LINES = ["CCL", "CEL", "CGL", "DTL", "EWL", "NEL", "NSL", "BPL", "SLRT", "PLRT", "TEL"] as const;

/** One station's platforms, for one 10-minute slot: low, moderate or high. */
const LtaCrowd = z.object({
  Station: z.string().trim().min(1),
  StartTime: z.iso.datetime({ offset: true }),
  EndTime: z.iso.datetime({ offset: true }),
  CrowdLevel: z.enum(["l", "m", "h"]),
});
type LtaCrowd = z.infer<typeof LtaCrowd>;

const DENSITY: Record<LtaCrowd["CrowdLevel"], DensityLevel> = { l: "LOW", m: "MEDIUM", h: "HIGH" };
const RANK: Record<DensityLevel, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };

/** Fewer stations than this means most lines failed to answer properly. */
const MIN_STATIONS = 100;

/** Real-time platform crowding at every station (D20), placed with the committed station file (D14). */
export class HotspotAdapter implements DatasetAdapter<HotspotDto[]> {
  private readonly stations: ReadonlyMap<string, Station>;
  private readonly warned = new Set<string>();

  constructor(stations: ReadonlyMap<string, Station> = loadStations()) {
    this.stations = stations;
  }

  getDataset(): Dataset {
    return "HOTSPOTS";
  }
  getSource(): Provider {
    return "LTA_DATAMALL";
  }
  getPaths(): readonly string[] {
    return TRAIN_LINES.map((line) => `/PCDRealTime?TrainLine=${line}`);
  }
  getRefreshInterval(): number {
    return 10 * 60 * 1000; // LTA's 10-minute slots (D20; the diagram's 30 minutes was for a forecast)
  }

  prepare(responses: readonly unknown[]): HotspotDto[] {
    // An interchange is one hotspot, at its busiest platform's level (City Hall reports as EW13 and as NS25)
    const busiest = new Map<string, { station: Station; row: LtaCrowd }>();
    for (const row of responses.flatMap((r) => parseRows(r, LtaCrowd, { minRows: 0 }))) {
      const station = this.stations.get(row.Station);
      if (!station) {
        this.warnOnce(row.Station);
        continue;
      }
      const seen = busiest.get(station.id);
      if (!seen || RANK[DENSITY[row.CrowdLevel]] > RANK[DENSITY[seen.row.CrowdLevel]])
        busiest.set(station.id, { station, row });
    }
    if (busiest.size < MIN_STATIONS)
      throw new Error(`only ${busiest.size} stations; expected at least ${MIN_STATIONS}`);

    return [...busiest.values()]
      .map(({ station, row }) => ({
        id: station.id,
        stationName: station.name,
        codes: station.codes,
        latitude: station.latitude,
        longitude: station.longitude,
        density: DENSITY[row.CrowdLevel],
        validFrom: new Date(row.StartTime).toISOString(),
        validTo: new Date(row.EndTime).toISOString(),
      }))
      .sort((a, b) => a.id.localeCompare(b.id)); // a stable order, so the ETag changes only with the data
  }

  /** A code missing from the station file (a station not open yet, or a new one): say so once, not every sync. */
  private warnOnce(code: string): void {
    if (this.warned.has(code)) return;
    this.warned.add(code);
    console.warn(`Hotspots: no position for station ${code}; rebuild train-stations.json if it has opened`);
  }
}
