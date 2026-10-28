import type { HotspotDto } from "@taxisstant/shared";
import { Hotspot } from "../entity/Hotspot";
import { Location } from "../entity/Location";

/** The server's plain JSON → a real Hotspot, for a busy station only: LOW stations aren't hotspots (D23). */
export function toHotspot(dto: HotspotDto): Hotspot | undefined {
  if (dto.density === "LOW") return undefined;
  return new Hotspot({
    id: dto.id,
    centre: new Location(dto.latitude, dto.longitude),
    stationName: dto.stationName,
    codes: dto.codes,
    density: dto.density,
    validFrom: new Date(dto.validFrom),
    validTo: new Date(dto.validTo),
  });
}
