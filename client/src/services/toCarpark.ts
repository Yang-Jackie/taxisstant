import type { CarparkDto } from "@taxisstant/shared";
import { Carpark } from "../entity/Carpark";
import { Location } from "../entity/Location";

/** The server's plain JSON → a real Carpark (D6). */
export function toCarpark(dto: CarparkDto): Carpark {
  return new Carpark({
    id: dto.id,
    name: dto.name,
    location: new Location(dto.latitude, dto.longitude),
    agency: dto.agency,
    area: dto.area,
  });
}
