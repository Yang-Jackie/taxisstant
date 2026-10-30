# TaxiMate: APIs, compression and data storage

Notes for the report: our backend API, the outside APIs we use, whether we use gzip, and how and where data is stored. They describe the app as built on 30 Oct 2026, checked against the code and the running service. Sizes and counts are from the night of 29 Oct.

Most of it matches the 23 Oct diagrams. The last section lists where it doesn't.

## 1. Our backend API

The data service (Node.js and Express) serves 11 endpoints under `/api`, all `GET`, all JSON. They give public data only, so there is no login. The full specification is [`shared/openapi.json`](../shared/openapi.json) (OpenAPI 3.1). Paste it into [editor.swagger.io](https://editor.swagger.io) to browse every endpoint and its schema, or to take screenshots of them.

**Pictures of the JSON format, ready for the report, are in [`json-format/`](json-format/):**
- `00-response-envelope.png` is the shape every response shares, plus the error body and the headers.
- `01-taxi-stands.png` to `11-rest-stop-sites.png` have one picture per endpoint: a real response (one item shown) beside a table of its fields, with each field's type and meaning, taken from the OpenAPI file.

### Every response has the same shape

```json
{
  "asOf": "2026-10-29T11:29:43.739Z",
  "etag": "\"eM-zv7fRimFNjLV_MUgpZuOy11Q\"",
  "data": [ ... ]
}
```

| Field | Meaning |
| --- | --- |
| `asOf` | When the server got this data from its source (ISO 8601, UTC) |
| `etag` | A fingerprint of the data |
| `data` | The list of items (each endpoint's own shape; examples at the end) |

Each response has these HTTP headers:
- `ETag`: the fingerprint.
- `Last-Modified`: the same moment as `asOf`.
- `Cache-Control: no-cache`.
- `Content-Encoding: gzip`, for clients that accept it (section 3).

The status codes:

| Status | When |
| --- | --- |
| 200 | The data |
| 304 Not Modified | The client sent `If-None-Match` with the current ETag, so it already has this data and no body is sent |
| 404 | No such endpoint. The body is `{ "error": "…" }` |
| 429 | More than 300 requests a minute from one address (the rate limit) |
| 503 | The service has just started and this dataset hasn't loaded yet (it takes about a minute) |

### The endpoints

**Static data**: places that rarely change. The server refreshes it daily, and the phone re-checks it daily.

| Endpoint | What it returns | Source | Items | Size (gzip) |
| --- | --- | --- | --- | --- |
| `/api/taxi-stands` | Every taxi stand and taxi stop | LTA DataMall | 316 | 50 kB (10 kB) |
| `/api/carparks` | Every HDB, URA and LTA carpark with car lots | LTA DataMall | 2,127 | 268 kB (63 kB) |
| `/api/hawker-centres` | Every hawker centre, with its stalls and closure dates | data.gov.sg (NEA) | 123 | 64 kB (10 kB) |
| `/api/fuel-stations` | Every petrol station | OpenStreetMap | 190 | 25 kB (5 kB) |
| `/api/charging-stations` | Every place with EV chargers | LTA DataMall | 2,807 | 785 kB (115 kB) |

**Live data**: it changes during the day. The phone polls it every 30 seconds, only while it is switched on and the app is on screen.

| Endpoint | What it returns | Source | Server refresh | Items | Size (gzip) |
| --- | --- | --- | --- | --- | --- |
| `/api/taxis` | Where the available taxis are | data.gov.sg | every 30 s | 2,000 | 85 kB (12 kB) |
| `/api/carparks/availability` | Free car lots per carpark (joins `/carparks` by `id`) | LTA DataMall | every minute | 2,127 | 70 kB (11 kB) |
| `/api/charging-stations/availability` | Free chargers per place (joins `/charging-stations` by `id`) | LTA DataMall | every 5 min | 2,807 | 132 kB (25 kB) |
| `/api/hotspots` | How crowded each MRT and LRT station is right now | LTA DataMall | every 10 min | 185 | 40 kB (7 kB) |
| `/api/pickup-sites` | Taxi stands scored for finding a passenger | our server, from taxi stands, taxis and hotspots | whenever those change | 316 | 82 kB (13 kB) |
| `/api/rest-stop-sites` | Hawker centres scored for a break | our server, from hawker centres, carparks, fuel, chargers and their free lots | whenever those change | 117 | 43 kB (7 kB) |

All 11 together are 1.64 MB as JSON, and 277 kB with gzip.

## 2. External APIs

### Called by our server

The phone never calls these: the server fetches them on a schedule and keeps the results (section 4). The LTA key stays on the server, in an environment variable (`server/.env`).

| Service | What we use | For | How often | Access |
| --- | --- | --- | --- | --- |
| **LTA DataMall** (`datamall2.mytransport.sg/ltaodataservice`) | `/TaxiStands` | Taxi stands | daily | API key (`AccountKey` header). Pages of 500 rows |
| | `/CarParkAvailabilityv2` | Carparks, and their free lots | daily, and every minute | |
| | `/EVCBatch` | Charging places, and their free chargers. It answers with a link to a file | daily, and every 5 min | |
| | `/PCDRealTime?TrainLine=…` (11 lines) | Platform crowd levels at each station | every 10 min | |
| **data.gov.sg** (`api.data.gov.sg`) | `/v1/transport/taxi-availability` | Available taxis | every 30 s | No key |
| **data.gov.sg** (`api-open.data.gov.sg`) | Dataset `d_bda4baa634dd1cc7a6c7cad5f19e2d68`, "Dates of Hawker Centres Closure" (NEA) | Hawker centres and their closures | daily | No key. It answers with a link to a file |
| **OpenStreetMap, Overpass API** (`overpass-api.de`) | A query for everything tagged `amenity=fuel` in Singapore | Petrol stations | daily | No key. The app names itself in a `User-Agent`, as OpenStreetMap asks |

Each request times out after 60 seconds. A server error (5xx) or a dropped connection is retried after 1 s, then after 3 s. If a fetch still fails, the server keeps the last good copy and tries again a minute later.

### Used by the phone directly

| Service | What | Access |
| --- | --- | --- |
| **OneMap** (Singapore Land Authority) | The map itself: tiles from `www.onemap.gov.sg/maps/tiles/Default/{z}/{x}/{y}.png`, or `Night` in dark mode | No key |
| **Google Maps** | Directions: a link the app opens (`https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>&travelmode=driving`). It's a link, not an API call. Only the destination is in it; Google Maps works out where the phone is itself. | No key |

### Used once, offline, to build a file

Station positions come from a file in the code, `server/src/reference-data/train-stations.json` (185 stations), not from a live API. A developer script (`npm run build-stations -w server`) builds it from three sources:
- LTA's `/PCDRealTime` for the station codes;
- OneMap's search API for each station's position;
- data.gov.sg's MRT station exits (dataset `d_b39d3a0871985372d7e1637193335da5`) to check those positions.

The script is run again only when a station opens.

## 3. Compression (gzip): yes

**Our server to the phone: yes, gzip.**
- The server compresses every API response for clients that ask for it (`Accept-Encoding: gzip`). Every browser does.
- Responses come back with `Content-Encoding: gzip` and `Vary: Accept-Encoding`.
- JSON shrinks about six times: all 11 endpoints go from 1.64 MB to 277 kB, and charging stations alone from 785 kB to 115 kB.
- It works together with the ETag check: a 304 has no body at all.
- It uses Express's `compression` middleware (`server/src/api/createHttpApp.ts`), and a test checks it (`createHttpApp.test.ts`).

**The outside APIs to our server: gzip when the provider offers it.** The server's requests say `Accept-Encoding: gzip, deflate` (Node.js does this by default) and unpack the answers automatically.

**On the phone, data is stored uncompressed** (section 4).

The `*.json.gz` files in `server/src/sample-data/` are recorded samples used by the tests only. They aren't part of the running app.

## 4. Data storage and data format

### Backend (the data service)

- **No database.** The server keeps the latest good copy of each of the 11 datasets in memory (`ServerDataCache`), in exactly the response shape above (`{ asOf, etag, data }`).
- **Each successful fetch replaces its copy; a failed one keeps the old copy.** Clients can see how old a copy is from its `asOf`.
- **Nothing is written to disk.** After a restart the server fetches everything again, which takes about a minute (503 until then).
- **The one stored file is part of the code:** `train-stations.json`, the station names, codes and positions (JSON).
- **No user data is on the server:** no accounts, no locations, no bookmarks. It only knows each request's IP address, for the rate limit.

### Frontend (the phone's browser)

The phone stores data in **IndexedDB**, the browser's built-in database, through the `idb` library. It doesn't use cookies or `localStorage`. There's one database, `taxisstant`, with one key-value store, `keyval`:

| Key | What | Format |
| --- | --- | --- |
| `preferences` | The driver's settings: which layers are on, the suggestions, the Bookmarks filter, vehicle type, font size, dark mode, language, the navigation prompt | An object of plain values and arrays |
| `bookmarks` | The saved places, newest first | An array of `{ id, layer, landmarkId, label, latitude, longitude, dateSaved }` |
| `lastLocation` | The last GPS position only, saved at most every 15 s, with no history | `{ latitude, longitude, accuracyM, at }` |
| `cache:/taxi-stands` … `cache:/rest-stop-sites` | The last response from each of the 11 endpoints, so the app works offline | `{ savedAt, response: { asOf, etag, data } }` |

How the phone uses its saved copies:
- **Static data** is re-checked once a day with its ETag. The answer is usually a 304, so nothing is downloaded again.
- **Live data** is replaced whenever new data arrives. A saved copy past its age limit isn't shown: taxis after 5 minutes, free lots and chargers after 15, crowd levels 30 minutes after their slot.
- **The location never leaves the phone.** It is used to rank suggestions on the phone, and only a destination goes to Google Maps.

The data is stored as plain JavaScript objects and arrays: the same shape as the JSON, not as text. Everything read back from storage, and everything downloaded, is checked against the schemas (zod), so old or damaged data is ignored rather than breaking the app.

### Data format between them

- **JSON over HTTP.** For data, the phone talks to our server only, with REST `GET` requests. The map tiles come from OneMap.
- **The contract lives in one place:** the schemas in `shared/` (zod), which give both sides their TypeScript types and generate `shared/openapi.json`.
- **Dates and times** are ISO 8601 in UTC. Coordinates are WGS 84 latitude and longitude in decimal degrees.
- **Over the internet the connection will be HTTPS** once the app is deployed (browsers only give a location to secure pages). For now the app runs locally on `http://localhost`, which browsers also count as secure.

## 5. Where the 23 Oct diagrams differ from the app

The diagrams' "HTTPS · REST / JSON · gzip + ETag · 11 GET endpoints", "no database" and "IndexedDB: prepared static data, last live data, preferences, bookmarks" are all right. These details aren't:

1. **"OneMap token refresh" (`ApiKeyStore`):** not needed. The map tiles need no token, and the server doesn't call OneMap at all. Station positions are built once into a file (section 2).
2. **The outside APIs:** the server uses a third provider the design doesn't show, OpenStreetMap, for petrol stations, because no government dataset lists them. It doesn't use data.gov.sg's "HDB carpark availability", because LTA's data already covers HDB, URA and LTA carparks.
3. **How often things refresh:**
   - Hotspots are real-time crowd levels every 10 minutes, not a forecast every 30.
   - Suggested sites are rebuilt whenever their inputs change (pickups as often as taxis, every 30 s), not on a 1–5 minute timer of their own.
4. **Phone storage** also keeps the last known position (`lastLocation`), so the map opens where the driver was.
5. **HTTPS:** as the diagrams say, for the deployed app. During development it's `http://localhost` (section 4).

For every other document (the class diagram, the use cases, the requirements, the data dictionary, the dialog map and the mockup), see [differences_from_docs.md](differences_from_docs.md).

## Example items, one per endpoint

Each endpoint's `data` is a list of items like these, real ones from 29 Oct (the hawker centre's closures are shortened to one). The full rules for every field are in [`shared/openapi.json`](../shared/openapi.json).

<details>
<summary>Static data</summary>

`/api/taxi-stands`
```json
{ "id": "A01", "name": "Orchard Rd along driveway of Lucky Plaza", "latitude": 1.304294727, "longitude": 103.8338467,
  "standType": "Stand", "isBarrierFree": true }
```

`/api/carparks`
```json
{ "id": "1", "name": "Suntec City", "latitude": 1.29375, "longitude": 103.85718, "agency": "LTA", "area": "Marina" }
```

`/api/hawker-centres`
```json
{ "id": "adam-road-food-centre", "name": "Adam Road Food Centre", "address": "2, Adam Road, Singapore 289876",
  "latitude": 1.324131966, "longitude": 103.8141632, "foodStalls": 32, "marketStalls": 0,
  "closures": [{ "from": "2026-12-07", "to": "2026-12-08", "reason": "cleaning" }] }
```

`/api/fuel-stations`
```json
{ "id": "way/391194371", "name": "Shell", "brand": "Shell", "latitude": 1.3722492, "longitude": 103.7634215,
  "address": "772 Upper Bukit Timah Road, Singapore 678122", "openingHours": "24/7" }
```

`/api/charging-stations`
```json
{ "id": "511142:103.959758", "name": "BLK 142A PASIR RIS STREET 11 MULTI STOREY CAR PARK",
  "address": "142A PASIR RIS STREET 11 SINGAPORE 511142", "latitude": 1.362839, "longitude": 103.959758,
  "operators": ["STRIDES YTL PTE. LTD."], "chargePoints": 3, "maxPowerKw": 7.4, "hasDcFast": false, "plugTypes": ["Type 2"] }
```

</details>

<details>
<summary>Live data</summary>

`/api/taxis`
```json
{ "latitude": 1.30075, "longitude": 103.62384 }
```

`/api/carparks/availability`
```json
{ "id": "1", "availableLots": 2839 }
```

`/api/charging-stations/availability`
```json
{ "id": "511142:103.959758", "availablePoints": 0 }
```

`/api/hotspots`
```json
{ "id": "admiralty", "stationName": "Admiralty", "codes": ["NS10"], "latitude": 1.440588561618472,
  "longitude": 103.800990519771, "density": "LOW",
  "validFrom": "2026-10-29T16:20:00.000Z", "validTo": "2026-10-29T16:30:00.000Z" }
```

`/api/pickup-sites`
```json
{ "id": "F61", "name": "Marina Coastal Dr outside Marina South Pier MRT Station", "latitude": 1.270634228,
  "longitude": 103.8621229, "radius": 300, "score": 1, "summary": "Marina South very crowded · no empty taxis nearby",
  "taxiCount": 0, "crowdDensity": "HIGH", "stationName": "Marina South" }
```

`/api/rest-stop-sites`
```json
{ "id": "aljunied-ave-2-blk-117-blk-117-aljunied-market-and-food-centre",
  "name": "Aljunied Ave 2 Blk 117 (Blk 117 Aljunied Market and Food Centre)", "latitude": 1.320709944,
  "longitude": 103.8870926, "radius": 500, "score": 1,
  "summary": "Food (79 stalls) · parking (792 free) · EV charging (17 free)", "foodStalls": 79, "hasParking": true,
  "freeLots": 792, "hasFuel": false, "hasCharging": true, "freeChargePoints": 17 }
```

</details>
