// Package 1 tests — the shared contract: what the zod schemas accept, and what they turn it into.
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  ApiError,
  ChargingStationDto,
  ENDPOINTS,
  FuelStationDto,
  HawkerClosure,
  TaxiStandDto,
  type ApiResponse,
} from "./index.js";

const stand = {
  id: "A01",
  name: "Lucky Plaza",
  latitude: 1.3043,
  longitude: 103.8338,
  standType: "Stand",
  isBarrierFree: true,
};
const body = { asOf: "2026-10-27T00:00:00.000Z", etag: '"v1"', data: [stand] };
const response = ENDPOINTS.taxiStands.response;

describe("ENDPOINTS.taxiStands.response", () => {
  it("accepts a real response and gives back the same data", () => {
    expect(response.parse(body)).toEqual(body);
  });

  it("drops fields it doesn't know, so the server can add fields without breaking older clients", () => {
    const parsed = response.parse({ ...body, extra: 1, data: [{ ...stand, colour: "red" }] });
    expect(parsed).toEqual(body);
  });

  it("rejects a response with anything missing or of the wrong type", () => {
    const { etag: _etag, ...noEtag } = body;
    const bad: unknown[] = [
      noEtag,
      { ...body, asOf: "yesterday" },
      { ...body, data: "stands" },
      { ...body, data: [{ ...stand, latitude: "1.30" }] },
      { ...body, data: [{ ...stand, isBarrierFree: "Yes" }] },
    ];
    for (const b of bad) expect(response.safeParse(b).success).toBe(false);
  });

  it("rejects coordinates that can't exist", () => {
    expect(TaxiStandDto.safeParse({ ...stand, latitude: 91 }).success).toBe(false);
    expect(TaxiStandDto.safeParse({ ...stand, longitude: -181 }).success).toBe(false);
  });

  it("infers the TypeScript types from the schemas — no hand-written DTOs", () => {
    expectTypeOf<TaxiStandDto>().toEqualTypeOf<{
      id: string;
      name: string;
      latitude: number;
      longitude: number;
      standType: string;
      isBarrierFree: boolean;
    }>();
    expectTypeOf(response.parse(body)).toEqualTypeOf<ApiResponse<TaxiStandDto[]>>();
  });
});

describe("ApiError", () => {
  it("is { error: string }", () => {
    expect(ApiError.parse({ error: "not loaded" })).toEqual({ error: "not loaded" });
    expect(ApiError.safeParse({ message: "not loaded" }).success).toBe(false);
  });
});

// Package 2a — the static layers' DTOs.

describe("the static layers' DTOs (package 2a)", () => {
  it("HawkerClosure takes real ISO dates and a known reason only", () => {
    expect(HawkerClosure.safeParse({ from: "2026-03-30", to: "2026-03-31", reason: "cleaning" }).success).toBe(true);
    expect(HawkerClosure.safeParse({ from: "30/3/2026", to: "2026-03-31", reason: "cleaning" }).success).toBe(false);
    expect(HawkerClosure.safeParse({ from: "2026-03-30", to: "2026-03-31", reason: "holiday" }).success).toBe(false);
  });

  it("FuelStationDto may lack a brand, an address and opening hours (OpenStreetMap doesn't always know)", () => {
    expect(
      FuelStationDto.safeParse({ id: "node/1", name: "Fuel station", latitude: 1.3, longitude: 103.8 }).success,
    ).toBe(true);
  });

  it("ChargingStationDto needs at least one operator and one charger", () => {
    const station = {
      id: "179024:103.846728",
      name: "CLARKE QUAY",
      address: "3E RIVER VALLEY ROAD SINGAPORE 179024",
      latitude: 1.290314,
      longitude: 103.846728,
      operators: ["SP MOBILITY PTE. LTD."],
      chargePoints: 3,
      hasDcFast: true,
      plugTypes: ["Combo 2", "Type 2"],
    };
    expect(ChargingStationDto.safeParse(station).success).toBe(true);
    expect(ChargingStationDto.safeParse({ ...station, operators: [] }).success).toBe(false);
    expect(ChargingStationDto.safeParse({ ...station, chargePoints: 0 }).success).toBe(false);
  });
});
