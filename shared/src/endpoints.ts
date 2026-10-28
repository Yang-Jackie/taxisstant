import { z } from "zod";
import { apiResponse, type ApiResponse } from "./ApiResponse.js";
import { CarparkDto } from "./CarparkDto.js";
import { ChargingStationDto } from "./ChargingStationDto.js";
import { FuelStationDto } from "./FuelStationDto.js";
import { HawkerCentreDto } from "./HawkerCentreDto.js";
import { TaxiStandDto } from "./TaxiStandDto.js";
import { CarparkAvailabilityDto } from "./CarparkAvailabilityDto.js";
import { ChargerAvailabilityDto } from "./ChargerAvailabilityDto.js";
import { HotspotDto } from "./HotspotDto.js";
import { TaxiDto } from "./TaxiDto.js";

/** One GET endpoint of our API: where it is, what it's for, and the exact shape of its JSON body. */
export interface Endpoint<T> {
  readonly path: `/${string}`;
  /** Names the OpenAPI operation (get<name>) and response schema (<name>Response). */
  readonly name: string;
  readonly summary: string;
  readonly description: string;
  readonly response: z.ZodType<ApiResponse<T>>;
}

function endpoint<T>(name: string, e: Omit<Endpoint<T>, "name" | "response"> & { data: z.ZodType<T> }): Endpoint<T> {
  const { data, ...rest } = e;
  return { ...rest, name, response: apiResponse(data).meta({ id: `${name}Response` }) };
}

/** Every endpoint the server serves and the client calls. The OpenAPI document is generated from this. */
export const ENDPOINTS = {
  taxiStands: endpoint("TaxiStands", {
    path: "/taxi-stands",
    summary: "Every taxi stand and taxi stop in Singapore",
    description: "Static data from LTA DataMall. The server refreshes it daily; clients re-check it daily.",
    data: z.array(TaxiStandDto),
  }),
  carparks: endpoint("Carparks", {
    path: "/carparks",
    summary: "Every HDB, URA and LTA carpark with car lots",
    description: "Static data from LTA DataMall, refreshed daily. Free lots are live data, served separately.",
    data: z.array(CarparkDto),
  }),
  hawkerCentres: endpoint("HawkerCentres", {
    path: "/hawker-centres",
    summary: "Every hawker centre, with its closures for cleaning and other works",
    description: "Static data from NEA (data.gov.sg, Dates of Hawker Centres Closure), refreshed daily.",
    data: z.array(HawkerCentreDto),
  }),
  fuelStations: endpoint("FuelStations", {
    path: "/fuel-stations",
    summary: "Every petrol station",
    description:
      "Static data from OpenStreetMap, refreshed daily. Data © OpenStreetMap contributors, available under the " +
      "Open Database Licence: show that credit wherever it is displayed.",
    data: z.array(FuelStationDto),
  }),
  chargingStations: endpoint("ChargingStations", {
    path: "/charging-stations",
    summary: "Every place with EV chargers",
    description: "Static data from LTA DataMall, refreshed daily. Free chargers are live data, served separately.",
    data: z.array(ChargingStationDto),
  }),
  taxis: endpoint("Taxis", {
    path: "/taxis",
    summary: "Where the available taxis are right now",
    description: "Live data from data.gov.sg, refreshed every 30 seconds. Clients poll it only while it is toggled on.",
    data: z.array(TaxiDto),
  }),
  carparkAvailability: endpoint("CarparkAvailability", {
    path: "/carparks/availability",
    summary: "Free car lots in every carpark",
    description: "Live data from LTA DataMall, refreshed every minute. Joins /carparks by id.",
    data: z.array(CarparkAvailabilityDto),
  }),
  chargerAvailability: endpoint("ChargerAvailability", {
    path: "/charging-stations/availability",
    summary: "Free chargers at every place with EV chargers",
    description: "Live data from LTA DataMall, refreshed every 5 minutes. Joins /charging-stations by id.",
    data: z.array(ChargerAvailabilityDto),
  }),
  hotspots: endpoint("Hotspots", {
    path: "/hotspots",
    summary: "How crowded each MRT and LRT station is right now",
    description: "Live data from LTA DataMall's platform crowd density, refreshed every 10 minutes.",
    data: z.array(HotspotDto),
  }),
};
