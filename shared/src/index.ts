// @taxisstant/shared — the API contract used by both client and server: zod schemas, and the types inferred from them.
export { ApiError, apiResponse, type ApiResponse } from "./ApiResponse.js";
export { CarparkAvailabilityDto } from "./CarparkAvailabilityDto.js";
export { CarparkDto } from "./CarparkDto.js";
export { ChargerAvailabilityDto } from "./ChargerAvailabilityDto.js";
export { ChargingStationDto } from "./ChargingStationDto.js";
export { ENDPOINTS, type Endpoint } from "./endpoints.js";
export { AVAILABILITY_MAX_AGE_MS, HOTSPOT_MAX_LAG_MS, TAXI_MAX_AGE_MS } from "./freshness.js";
export { FuelStationDto } from "./FuelStationDto.js";
export { Latitude, Longitude } from "./geo.js";
export { HawkerCentreDto, HawkerClosure } from "./HawkerCentreDto.js";
export { DensityLevel, HotspotDto } from "./HotspotDto.js";
export { SuggestedPickupDto, SuggestedRestStopDto } from "./SuggestedSiteDtos.js";
export { TaxiDto } from "./TaxiDto.js";
export { TaxiStandDto } from "./TaxiStandDto.js";
