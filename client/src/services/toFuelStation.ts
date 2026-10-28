import type { FuelStationDto } from "@taxisstant/shared";
import { FuelStation } from "../entity/FuelStation";
import { Location } from "../entity/Location";

/** The server's plain JSON → a real FuelStation (D6). */
export function toFuelStation(dto: FuelStationDto): FuelStation {
  return new FuelStation({
    id: dto.id,
    name: dto.name,
    location: new Location(dto.latitude, dto.longitude, dto.address),
    brand: dto.brand,
    openingHours: dto.openingHours,
  });
}
