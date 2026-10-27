/** A taxi stand as the server sends it and the client receives it (plain JSON, no methods). */
export interface TaxiStandDto {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  standType: string;
  isBarrierFree: boolean;
}
