import type { HawkerCentreDto, HawkerClosure } from "@taxisstant/shared";
import { z } from "zod";
import type { Dataset } from "../../cache/Dataset.js";
import type { Provider } from "../../external/Provider.js";
import type { DatasetAdapter } from "../DatasetAdapter.js";
import { parseRows, uniqueBy } from "../parseRows.js";

const decimal = z
  .string()
  .trim()
  .regex(/^-?\d+(\.\d+)?$/)
  .transform(Number);
const count = z.string().trim().regex(/^\d+$/).transform(Number);

/** One row of NEA's "Dates of Hawker Centres Closure" (a CSV, so every value is a string). */
const NeaHawkerCentre = z.object({
  name: z.string().trim().min(1),
  address_myenv: z.string().trim(),
  latitude_hc: decimal,
  longitude_hc: decimal,
  no_of_food_stalls: count,
  no_of_market_stalls: count,
  q1_cleaningstartdate: z.string(),
  q1_cleaningenddate: z.string(),
  remarks_q1: z.string(),
  q2_cleaningstartdate: z.string(),
  q2_cleaningenddate: z.string(),
  remarks_q2: z.string(),
  q3_cleaningstartdate: z.string(),
  q3_cleaningenddate: z.string(),
  remarks_q3: z.string(),
  q4_cleaningstartdate: z.string(),
  q4_cleaningenddate: z.string(),
  remarks_q4: z.string(),
  other_works_startdate: z.string(),
  other_works_enddate: z.string(),
  remarks_other_works: z.string(),
});
type NeaHawkerCentre = z.infer<typeof NeaHawkerCentre>;

/** NEA writes dates as d/m/yyyy, or "NA" (no closure) or "TBC" (not dated yet). Returns yyyy-mm-dd, or undefined. */
export function neaDate(value: string): string | undefined {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!m) return undefined;
  const iso = `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  const date = new Date(`${iso}T00:00:00Z`); // JavaScript rolls 31/2 over to 3/3, and gives Invalid Date for 1/13
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(iso) ? iso : undefined;
}

function closure(from: string, to: string, reason: HawkerClosure["reason"], remarks: string): HawkerClosure[] {
  const start = neaDate(from);
  const end = neaDate(to);
  if (!start || !end || end < start) return [];
  const note = remarks.trim();
  return [{ from: start, to: end, reason, ...(note && note.toLowerCase() !== "nil" && { remarks: note }) }];
}

function closuresOf(c: NeaHawkerCentre): HawkerClosure[] {
  return [
    ...closure(c.q1_cleaningstartdate, c.q1_cleaningenddate, "cleaning", c.remarks_q1),
    ...closure(c.q2_cleaningstartdate, c.q2_cleaningenddate, "cleaning", c.remarks_q2),
    ...closure(c.q3_cleaningstartdate, c.q3_cleaningenddate, "cleaning", c.remarks_q3),
    ...closure(c.q4_cleaningstartdate, c.q4_cleaningenddate, "cleaning", c.remarks_q4),
    ...closure(c.other_works_startdate, c.other_works_enddate, "works", c.remarks_other_works),
  ];
}

/** "Adam Road Food Centre" → "adam-road-food-centre". NEA's serial numbers shift as centres are added. */
const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Hawker centres and their closures, from one NEA dataset on data.gov.sg (D13). */
export class HawkerCentreAdapter implements DatasetAdapter<HawkerCentreDto[]> {
  getDataset(): Dataset {
    return "HAWKER_CENTRES";
  }
  getSource(): Provider {
    return "DATA_GOV_SG";
  }
  getPath(): string {
    return "d_bda4baa634dd1cc7a6c7cad5f19e2d68"; // Dates of Hawker Centres Closure (NEA)
  }
  getRefreshInterval(): number {
    return 24 * 60 * 60 * 1000; // daily: static data (D1)
  }

  prepare(raw: unknown): HawkerCentreDto[] {
    const centres = parseRows(raw, NeaHawkerCentre, { minRows: 80 });
    return uniqueBy(centres, (c) => slug(c.name)).map((c) => ({
      id: slug(c.name),
      name: c.name,
      address: c.address_myenv,
      latitude: c.latitude_hc,
      longitude: c.longitude_hc,
      foodStalls: c.no_of_food_stalls,
      marketStalls: c.no_of_market_stalls,
      closures: closuresOf(c),
    }));
  }
}
