import { z } from "zod";
import { apiResponse, type ApiResponse } from "./ApiResponse.js";
import { TaxiStandDto } from "./TaxiStandDto.js";

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
};
