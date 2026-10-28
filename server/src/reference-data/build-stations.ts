// Builds train-stations.json (D14): npm run build-stations -w server (needs LTA_ACCOUNT_KEY in .env). Run it when a
// line or station opens. Codes come from LTA's crowd API, positions from OneMap search, checked against LTA's station
// exits on data.gov.sg. OneMap's search still answers without a token (Oct 2026); if that changes, add one here.
import { writeFileSync } from "node:fs";
import { z } from "zod";
import { ApiKeyStore } from "../external/ApiKeyStore.js";
import { ExternalApiFacade } from "../external/ExternalApiFacade.js";
import { metresBetween } from "../sync/geo.js";
import { TRAIN_LINES } from "../sync/adapters/HotspotAdapter.js";
import type { Station } from "./stations.js";

const facade = new ExternalApiFacade(new ApiKeyStore(), fetch, 60_000);

/**
 * Codes the crowd API uses that OneMap doesn't list: the Circle Line Extension's old codes (OneMap now has Bayfront
 * as DT16/CC34) and Punggol's LRT hub. Station ids as built below.
 */
const ALIASES: Record<string, string> = { CE1: "bayfront", CE2: "marina-bay", PTC: "punggol" };
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** "CITY HALL" → "City Hall", "ONE-NORTH" → "One-North". */
const titleCase = (s: string) =>
  s.toLowerCase().replace(/(^|[\s(-])([a-z])/g, (_, gap: string, c: string) => gap + c.toUpperCase());
const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// 1. Every station code LTA's crowd API reports
const codes = new Set<string>();
for (const line of TRAIN_LINES) {
  const rows = z
    .array(z.object({ Station: z.string() }))
    .parse(await facade.fetch("LTA_DATAMALL", `/PCDRealTime?TrainLine=${line}`));
  for (const row of rows) codes.add(row.Station);
}
console.log(`${codes.size} station codes from ${TRAIN_LINES.length} lines`);

// 2. LTA's station exits (data.gov.sg), averaged per station name, to check OneMap's positions
const exits = z
  .object({
    features: z.array(
      z.object({
        properties: z.object({ STATION_NA: z.string() }),
        geometry: z.object({ coordinates: z.array(z.number()) }),
      }),
    ),
  })
  .parse(await facade.fetch("DATA_GOV_SG", "d_b39d3a0871985372d7e1637193335da5"));
const exitPoints = new Map<string, { lat: number; lon: number }[]>();
for (const f of exits.features) {
  const name = f.properties.STATION_NA.replace(/ (MRT|LRT) STATION$/, "").trim();
  const [lon, lat] = f.geometry.coordinates as [number, number];
  exitPoints.set(name, [...(exitPoints.get(name) ?? []), { lat, lon }]);
}

// 3. Each code's station from OneMap search: "CITY HALL MRT STATION (EW13 / NS25)"
const OneMapResults = z.object({
  results: z.array(z.object({ SEARCHVAL: z.string(), LATITUDE: z.string(), LONGITUDE: z.string() })),
});
async function search(code: string) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(
      `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(code)}&returnGeom=Y&getAddrDetails=N&pageNum=1`,
    );
    const parsed = OneMapResults.safeParse(await res.json().catch(() => undefined));
    if (parsed.success) return parsed.data.results;
    await sleep(attempt * 2000); // rate limited: wait and try again
  }
  throw new Error(`OneMap search for ${code} kept failing`);
}

const stations = new Map<string, Station>();
const unopened = new Set<string>();
const missing: string[] = [];
for (const code of [...codes].sort()) {
  if ([...stations.values()].some((s) => s.codes.includes(code)) || code in ALIASES) continue; // found already
  await sleep(300);
  const hit = (await search(code))
    .map((r) => ({ r, m: /^(.*) (MRT|LRT) STATION \(([^)]+)\)$/.exec(r.SEARCHVAL) }))
    .find(
      ({ m }) =>
        m &&
        m[3]!
          .split("/")
          .map((c) => c.trim())
          .includes(code),
    );
  if (!hit?.m) {
    missing.push(code);
    continue;
  }
  const upper = hit.m[1]!;
  const station: Station = {
    id: slug(upper),
    name: titleCase(upper),
    codes: hit.m[3]!.split("/")
      .map((c) => c.trim())
      .sort(),
    latitude: Number(hit.r.LATITUDE),
    longitude: Number(hit.r.LONGITUDE),
  };
  const points = exitPoints.get(upper);
  if (points) {
    const centre = {
      lat: points.reduce((n, p) => n + p.lat, 0) / points.length,
      lon: points.reduce((n, p) => n + p.lon, 0) / points.length,
    };
    const off = metresBetween(centre, { lat: station.latitude, lon: station.longitude });
    if (off > 400) console.warn(`${station.name}: OneMap's position is ${Math.round(off)} m from LTA's exits`);
  } else {
    unopened.add(station.id); // no exits yet: the crowd API already lists stations still being built
  }
  // OneMap lists some interchanges once per line ("MARINA BAY MRT STATION (NS27)", "... (TE20)"): merge their codes
  const known = stations.get(station.id);
  if (known) {
    const apart = metresBetween(
      { lat: known.latitude, lon: known.longitude },
      { lat: station.latitude, lon: station.longitude },
    );
    if (apart > 400) console.warn(`${station.name}: OneMap's entries are ${Math.round(apart)} m apart`);
    stations.set(station.id, { ...known, codes: [...new Set([...known.codes, ...station.codes])].sort() });
  } else {
    stations.set(station.id, station);
  }
}

for (const [code, id] of Object.entries(ALIASES)) {
  const station = stations.get(id);
  if (!station) throw new Error(`alias ${code}: no station ${id}`);
  stations.set(id, { ...station, codes: [...new Set([...station.codes, code])].sort() });
}
for (const id of unopened) stations.delete(id);

const generatedOn = new Date().toISOString().slice(0, 10);
const sorted = [...stations.values()].sort((a, b) => a.name.localeCompare(b.name));
writeFileSync(
  new URL("train-stations.json", import.meta.url),
  `${JSON.stringify({ generatedOn, stations: sorted }, null, 2)}\n`,
);
console.log(`Wrote ${sorted.length} stations. Left out, not open yet: ${[...unopened].join(", ") || "none"}`);
console.log(`Codes not found anywhere: ${missing.join(", ") || "none"}`);
