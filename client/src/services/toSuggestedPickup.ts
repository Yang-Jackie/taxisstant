import type { SuggestedPickupDto } from "@taxisstant/shared";
import { Location } from "../entity/Location";
import { SuggestedPickup } from "../entity/SuggestedPickup";

/** The server's plain JSON → a real SuggestedPickup, scored when the server's list was built (D6). */
export function toSuggestedPickup(dto: SuggestedPickupDto, asOf: Date): SuggestedPickup {
  return new SuggestedPickup({
    id: dto.id,
    name: dto.name,
    centre: new Location(dto.latitude, dto.longitude),
    radius: dto.radius,
    score: dto.score,
    summary: dto.summary,
    asOf,
    taxiCount: dto.taxiCount,
    crowdDensity: dto.crowdDensity,
    stationName: dto.stationName,
  });
}
