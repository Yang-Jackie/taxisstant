// Test helpers: a fake server for the static endpoints, answering with small bodies that fit the shared contract.
import type {
  CarparkAvailabilityDto,
  CarparkDto,
  ChargerAvailabilityDto,
  ChargingStationDto,
  FuelStationDto,
  HawkerCentreDto,
  HotspotDto,
  TaxiDto,
  TaxiStandDto,
} from "@taxisstant/shared";
import { vi } from "vitest";

export const STANDS: TaxiStandDto[] = [
  {
    id: "A01",
    name: "Orchard Rd along driveway of Lucky Plaza",
    latitude: 1.304294727,
    longitude: 103.8338467,
    standType: "Stand",
    isBarrierFree: true,
  },
  {
    id: "A05",
    name: "Mt Elizabeth Rd at Mt Elizabeth Hospital",
    latitude: 1.304571786,
    longitude: 103.835547,
    standType: "Stand",
    isBarrierFree: true,
  },
  {
    id: "A06",
    name: "Cairnhill Rd at Cairnhill Nine",
    latitude: 1.303519805,
    longitude: 103.8376729,
    standType: "Stop",
    isBarrierFree: false,
  },
];
export const CARPARKS: CarparkDto[] = [
  { id: "1", name: "Suntec City", latitude: 1.29375, longitude: 103.85718, agency: "LTA", area: "Marina" },
  { id: "A2", name: "BLK 206/207 ANG MO KIO STREET 22", latitude: 1.366237, longitude: 103.843046, agency: "HDB" },
];
export const FUEL: FuelStationDto[] = [
  {
    id: "way/391194371",
    name: "Shell",
    brand: "Shell",
    latitude: 1.3722492,
    longitude: 103.7634215,
    address: "772 Upper Bukit Timah Road, Singapore 678122",
    openingHours: "24/7",
  },
];
export const CHARGERS: ChargingStationDto[] = [
  {
    id: "179024:103.846728",
    name: "CLARKE QUAY",
    address: "3E RIVER VALLEY ROAD SINGAPORE 179024",
    latitude: 1.290314,
    longitude: 103.846728,
    operators: ["SP MOBILITY PTE. LTD."],
    chargePoints: 3,
    maxPowerKw: 50,
    hasDcFast: true,
    plugTypes: ["Combo 2", "Type 2"],
  },
];
export const HAWKERS: HawkerCentreDto[] = [
  {
    id: "adam-road-food-centre",
    name: "Adam Road Food Centre",
    address: "2, Adam Road, Singapore 289876",
    latitude: 1.324131966,
    longitude: 103.8141632,
    foodStalls: 32,
    marketStalls: 0,
    closures: [{ from: "2026-12-07", to: "2026-12-08", reason: "cleaning" }],
  },
];

/** Three taxis in Orchard, within 200 m of each other, and one in Jurong. */
export const TAXIS: TaxiDto[] = [
  { latitude: 1.3045, longitude: 103.8335 },
  { latitude: 1.3048, longitude: 103.8345 },
  { latitude: 1.3041, longitude: 103.8352 },
  { latitude: 1.3329, longitude: 103.7436 },
];
export const CARPARK_LOTS: CarparkAvailabilityDto[] = [
  { id: "1", availableLots: 117 },
  { id: "A2", availableLots: 3 },
];
export const CHARGER_POINTS: ChargerAvailabilityDto[] = [{ id: "179024:103.846728", availablePoints: 2 }];

/** City Hall very crowded, Dhoby Ghaut crowded, Jurong East quiet, in the 10-minute slot that ended 15 minutes before `now`. */
export function hotspotsAt(now: Date): HotspotDto[] {
  const validTo = new Date(now.getTime() - 15 * 60 * 1000);
  const slot = {
    validFrom: new Date(validTo.getTime() - 10 * 60 * 1000).toISOString(),
    validTo: validTo.toISOString(),
  };
  return [
    {
      id: "city-hall",
      stationName: "City Hall",
      codes: ["EW13", "NS25"],
      latitude: 1.2931,
      longitude: 103.852,
      density: "HIGH",
      ...slot,
    },
    {
      id: "dhoby-ghaut",
      stationName: "Dhoby Ghaut",
      codes: ["CC1", "NE6", "NS24"],
      latitude: 1.2989,
      longitude: 103.8457,
      density: "MEDIUM",
      ...slot,
    },
    {
      id: "jurong-east",
      stationName: "Jurong East",
      codes: ["EW24", "NS1"],
      latitude: 1.3332,
      longitude: 103.7422,
      density: "LOW",
      ...slot,
    },
  ];
}

/** Each endpoint's data, by path under /api. Live data is made at the moment it is asked for, so it is current. */
export const DATA: Record<string, unknown[] | (() => unknown[])> = {
  "/taxis": TAXIS,
  "/carparks/availability": CARPARK_LOTS,
  "/charging-stations/availability": CHARGER_POINTS,
  "/hotspots": () => hotspotsAt(new Date()),
  "/taxi-stands": STANDS,
  "/carparks": CARPARKS,
  "/fuel-stations": FUEL,
  "/charging-stations": CHARGERS,
  "/hawker-centres": HAWKERS,
};

export type Answer = (init?: RequestInit) => Promise<Response>;

/** A 200 with `data`, as of the moment it is answered (live layers check how old their data is, D22). */
export const ok =
  (data: unknown[] | (() => unknown[]), etag = '"v1"'): Answer =>
  async () =>
    new Response(
      JSON.stringify({ asOf: new Date().toISOString(), etag, data: typeof data === "function" ? data() : data }),
      {
        status: 200,
      },
    );
export const status =
  (code: number): Answer =>
  async () =>
    new Response(code === 304 ? null : "{}", { status: code });
export const offline: Answer = () => Promise.reject(new TypeError("Failed to fetch"));

/** A fetch that answers each endpoint with its data, unless `answers` says otherwise for that path (or for all: "*"). */
export function fakeServer(answers: Record<string, Answer> = {}) {
  return vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>(async (input, init) => {
    const path = new URL(String(input), "http://test").pathname.replace(/^\/api/, "");
    const answer = answers[path] ?? answers["*"] ?? (DATA[path] ? ok(DATA[path]!) : status(404));
    return answer(init);
  });
}

/** How many requests went to one endpoint. */
export function callsTo(fetchFn: ReturnType<typeof fakeServer>, path: string): number {
  return fetchFn.mock.calls.filter(([input]) => new URL(String(input), "http://test").pathname === `/api${path}`)
    .length;
}
