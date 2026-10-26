/** A taxi stand as the server serves it. Moves to shared/ in M5, so the client uses the same type. */
export interface TaxiStandDto {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  standType: string;
  isBarrierFree: boolean;
}
