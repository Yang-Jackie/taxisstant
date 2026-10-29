import type { SuggestedRestStopDto } from "@taxisstant/shared";
import { Location } from "../entity/Location";
import { SuggestedRestStop } from "../entity/SuggestedRestStop";

/** The server's plain JSON → a real SuggestedRestStop, scored when the server's list was built (D6). */
export function toSuggestedRestStop(dto: SuggestedRestStopDto, asOf: Date): SuggestedRestStop {
  return new SuggestedRestStop({
    id: dto.id,
    name: dto.name,
    centre: new Location(dto.latitude, dto.longitude),
    radius: dto.radius,
    score: dto.score,
    summary: dto.summary,
    asOf,
    foodStalls: dto.foodStalls,
    hasParking: dto.hasParking,
    freeLots: dto.freeLots,
    hasFuel: dto.hasFuel,
    hasCharging: dto.hasCharging,
    freeChargePoints: dto.freeChargePoints,
  });
}
