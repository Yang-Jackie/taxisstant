// @taxisstant/shared — the API contract used by both client and server: zod schemas, and the types inferred from them.
export { ApiError, apiResponse, type ApiResponse } from "./ApiResponse.js";
export { CarparkDto } from "./CarparkDto.js";
export { ChargingStationDto } from "./ChargingStationDto.js";
export { ENDPOINTS, type Endpoint } from "./endpoints.js";
export { FuelStationDto } from "./FuelStationDto.js";
export { Latitude, Longitude } from "./geo.js";
export { HawkerCentreDto, HawkerClosure } from "./HawkerCentreDto.js";
export { TaxiStandDto } from "./TaxiStandDto.js";
