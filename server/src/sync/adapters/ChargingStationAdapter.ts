import type { ChargingStationDto } from "@taxisstant/shared";
import { z } from "zod";
import type { Dataset } from "../../cache/Dataset.js";
import type { Provider } from "../../external/Provider.js";
import type { DatasetAdapter } from "../DatasetAdapter.js";
import { parseRows, uniqueBy } from "../parseRows.js";

const LtaPlug = z.object({ plugType: z.string(), current: z.string(), powerRating: z.string() });
const LtaCharger = z.object({ operator: z.string().trim().min(1), plugTypes: z.array(LtaPlug) });

/** One location in LTA's EV batch file. About 4% have no name: those show their address instead. */
const LtaEvLocation = z.object({
  name: z.string().trim(),
  address: z.string().trim().min(1),
  postalCode: z.string().trim().min(1),
  latitude: z.number(),
  longtitude: z.number(), // sic: LTA's spelling
  chargingPoints: z.array(LtaCharger).min(1),
});
type LtaEvLocation = z.infer<typeof LtaEvLocation>;

/** Each value once, sorted: LTA's charger order varies, and a different order would change the ETag for nothing. */
const distinct = (values: string[]) => [...new Set(values)].sort();

function toDto(l: LtaEvLocation): ChargingStationDto {
  const plugs = l.chargingPoints.flatMap((c) => c.plugTypes);
  const powers = plugs.map((p) => Number(p.powerRating)).filter((kw) => Number.isFinite(kw) && kw > 0);
  return {
    id: `${l.postalCode}:${l.longtitude.toFixed(6)}`,
    name: l.name || l.address,
    address: l.address,
    latitude: l.latitude,
    longitude: l.longtitude,
    operators: distinct(l.chargingPoints.map((c) => c.operator)),
    chargePoints: l.chargingPoints.length,
    ...(powers.length > 0 && { maxPowerKw: Math.max(...powers) }),
    hasDcFast: plugs.some((p) => p.current === "DC"),
    plugTypes: distinct(plugs.map((p) => p.plugType)),
  };
}

/** EV charging locations, from LTA's EV batch file (the facade follows its download link). */
export class ChargingStationAdapter implements DatasetAdapter<ChargingStationDto[]> {
  getDataset(): Dataset {
    return "CHARGING_STATIONS";
  }
  getSource(): Provider {
    return "LTA_DATAMALL";
  }
  getPath(): string {
    return "/EVCBatch";
  }
  getRefreshInterval(): number {
    return 24 * 60 * 60 * 1000; // daily: the locations are static; free chargers are live data (package 2c)
  }

  prepare(raw: unknown): ChargingStationDto[] {
    const { evLocationsData } = z.object({ evLocationsData: z.unknown() }).parse(raw);
    const locations = parseRows(evLocationsData, LtaEvLocation, { minRows: 1000 });
    return uniqueBy(locations.map(toDto), (s) => s.id);
  }
}
