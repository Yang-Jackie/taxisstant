import type { TaxiStandDto } from "@taxisstant/shared";
import { Location } from "../entity/Location";
import { TaxiStand } from "../entity/TaxiStand";

/** The server's plain JSON → a real TaxiStand with its methods (D6). */
export function toTaxiStand(dto: TaxiStandDto): TaxiStand {
  return new TaxiStand({
    id: dto.id,
    name: dto.name,
    location: new Location(dto.latitude, dto.longitude),
    standType: dto.standType,
    isBarrierFree: dto.isBarrierFree,
  });
}
