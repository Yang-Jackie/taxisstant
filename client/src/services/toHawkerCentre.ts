import type { HawkerCentreDto } from "@taxisstant/shared";
import { HawkerCentre } from "../entity/HawkerCentre";
import { Location } from "../entity/Location";

/** The server's plain JSON → a real HawkerCentre (D6). */
export function toHawkerCentre(dto: HawkerCentreDto): HawkerCentre {
  return new HawkerCentre({
    id: dto.id,
    name: dto.name,
    location: new Location(dto.latitude, dto.longitude, dto.address),
    foodStalls: dto.foodStalls,
    marketStalls: dto.marketStalls,
    closures: dto.closures,
  });
}
