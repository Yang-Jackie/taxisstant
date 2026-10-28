import type { TaxiDto } from "@taxisstant/shared";
import { Location } from "../entity/Location";
import { Taxi } from "../entity/Taxi";

/** The server's plain JSON → a real Taxi, seen when the server's snapshot was taken (D6). */
export function toTaxi(dto: TaxiDto, seenAt: Date): Taxi {
  return new Taxi(new Location(dto.latitude, dto.longitude), seenAt);
}
