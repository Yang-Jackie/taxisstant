import type { ChargingStationDto } from "@taxisstant/shared";
import { ChargingStation } from "../entity/ChargingStation";
import { Location } from "../entity/Location";

/** The server's plain JSON → a real ChargingStation (D6). */
export function toChargingStation(dto: ChargingStationDto): ChargingStation {
  return new ChargingStation({
    id: dto.id,
    name: dto.name,
    location: new Location(dto.latitude, dto.longitude, dto.address),
    operators: dto.operators,
    chargePoints: dto.chargePoints,
    maxPowerKw: dto.maxPowerKw,
    hasDcFast: dto.hasDcFast,
    plugTypes: dto.plugTypes,
  });
}
