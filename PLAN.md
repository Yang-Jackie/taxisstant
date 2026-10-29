# Taxi Assistant — Build Plan

A mobile-layout web app for Singapore taxi drivers, built from the SC2006 team's Lab 1–3 design
([softwarelab3/2006-SCSC-F2](https://github.com/softwarelab3/2006-SCSC-F2)).

The build starts from an empty folder and has two phases:

- **Phase 1 (learning):** I hand-code one feature, UC 0001 "Toggle Taxi Stands", through every layer of the architecture. Claude handles the setup and tooling that teach little.
- **Phase 2 (finishing):** Claude builds the rest of the app one work package at a time, and I review each package at a checkpoint.

I'm the only one writing code, so Phase 2 covers the whole app. Nothing is copied from the team's AI-generated skeleton (`lab3/Skeleton`). The spec is the design documents themselves.

## Sources

| What | Where |
|---|---|
| **This project's code** | [github.com/Yang-Jackie/taxisstant](https://github.com/Yang-Jackie/taxisstant) |
| **Design model (class diagram), current version** | `Lab3_DesignModel.drawio` (diagrams.net), version from 23 Oct |
| **Layered and deployment architecture, current version** | `Lab3_SystemArchitecture.drawio` (diagrams.net), version from 23 Oct |
| Use cases UC 0001–0013, FR/NFR, data dictionary | team repo: `lab3/Lab 3 Report.pdf` |
| Tech stack and the team's critique of the earlier design | team repo: `lab3/Lab 3 - AI Report.pdf` |
| Dialog map (screen flow) | team repo: `lab3/Diagrams/dialog map.png` |

The PNGs in the team repo (`lab3/Diagrams/`, 15 Oct) are **out of date**. They still show `LandmarkRepository`, `CrowdForecast`, `RestStopSite` and recommendations calculated on the client.

## Stack (decided in Lab 3)

- **Monorepo:** npm workspaces with `client/`, `server/` and `shared/`, all under the `@taxisstant/` package scope
- **Client:** React, TypeScript, Vite, react-leaflet with OneMap tiles, IndexedDB (`idb`), i18next (EN/ZH)
- **Server:** Node, Express and TypeScript; a timer-based scheduled sync (`setTimeout`, no node-cron: adapters declare intervals, not clock times); an in-memory cache and no database; API keys kept in `.env`
- **Contract:** zod schemas in `shared/`; the TypeScript types are inferred from them, and `shared/openapi.json` is generated from them (D11).
- **Tests:** Vitest, Supertest, Testing Library, fake-indexeddb
- **TypeScript 7:** `strict` is on by default, and `@types` packages are only loaded when listed in `types`.

---

## Codebase design (from the 23 Oct diagrams)

### How the system works
- **Server:**
  - fetches government data on a schedule
  - prepares it, one adapter per dataset
  - **scores the suggested pickup and rest-stop sites once for all drivers**, using the Strategy pattern
  - serves everything through 11 GET endpoints: 5 static and 6 live
- **Client:**
  - caches what it receives and works offline
  - **ranks the suggested sites by distance from the driver**, so the driver's location never leaves the phone
  - draws everything on the map

### Client: `client/src/`

| Folder | Layer | Classes, from the design model | Built in |
|---|---|---|---|
| `entity/` | Domain objects | `LayerType`, `Location`, **`Locatable`** (interface) | M1 |
| | | `Bounds` and `Viewport` (the design model's Bounds, plus zoom: D17) | 2b |
| | | abstract `Landmark` → `TaxiStand` | M1 |
| | | **`MapDataRepository`** («container»): `getByLayerType`, `replaceLayer` | M1 |
| | | `MapDataRepository`: `updateAvailability`, `getSuggestions`, `replaceSuggestions` | Phase 2 |
| | | `Carpark`, `FuelStation`, `ChargingStation`, `HawkerCentre` (Landmarks) | Phase 2 |
| | | `Taxi` (Locatable) | Phase 2 |
| | | abstract `Site` → `Hotspot`; abstract `SuggestedSite` → `SuggestedPickup`, `SuggestedRestStop` | Phase 2 |
| | | `UserPreferences`, `Bookmark`, `BookmarkList`, `TaxiDriver` | M6 / Phase 2 |
| | | `Language`, `VehicleType`, `RecommendationKind`, `DensityLevel` | when needed |
| `services/` | Data access & device services | `DataApiClient` | M5 |
| | | one DTO-to-entity converter per static layer (`toTaxiStand`, `toCarpark`, …) | M5, 2b |
| | | `LocalStore` | M6 |
| | | `CacheManager` | M7 |
| | | `GPSInterface`, `NavigationGateway` | Phase 2 |
| `control/` | Application logic | `MapDisplayController`, `SettingsController`, `DataSyncController` | M6 |
| | | `DataSyncObserver`, `LocationObserver` (interfaces) | M6 / Phase 2 |
| | | `LayerClusters` (Supercluster): what `refreshVisible` shows at each zoom (D17) | 2b |
| | | `LocationController`, `NavigationController`, `RecommendationController`, `BookmarkController` | Phase 2 |
| `boundary/` | Presentation (React) | `MapView`, `FilterTool` | M4 |
| | | `LandmarkDetails` (marker popups), `markerIcons` | 2b |
| | | `Sidemenu`, `RecommendationCard`, `BookmarkPanel`, `SettingsView` | Phase 2 |
| `startup.ts`, `main.tsx` | «startup» | `initControllers()` creates the services and controllers once, outside React; `App` gets them through `ControllersContext`; `loadCached()` joins in M7 | M6 |

- **Inheritance in the domain layer:**
  - `Landmark`, `Site` and `Taxi` all implement `Locatable`, so the map can draw any of them.
  - `Hotspot` and `SuggestedSite` extend `Site`, which is an area: a centre plus a radius.
- **`boundary/` holds React components only.** `DataApiClient`, `GPSInterface` and `NavigationGateway` are labelled «boundary» in the design model, but the layered diagram puts them in the bottom layer, so they go in `services/`.

### Server: `server/src/`

The server is organised by component, the same grouping as the deployment diagram:

```
server/src/
├── DataServiceApp.ts        «startup»
├── api/                     DataApiController
├── cache/                   ServerDataCache, Dataset
├── sync/                    SyncService, DatasetAdapter, parseRows (D16), geo
│   ├── adapters/            static: TaxiStand, Carpark, HawkerCentre, FuelStation, ChargingStation; live: Taxi, CarparkAvailability, ChargerAvailability, Hotspot
│   └── strategies/          Phase 2: SuggestionStrategy and its two strategies
├── external/                ExternalApiFacade (one client per provider), ApiKeyStore, Provider
├── reference-data/          train-stations.json (D14) and build-stations.ts, which rebuilds it
└── sample-data/             real recorded provider responses for tests; record.ts refreshes them
```


| Class | Role | Built in |
|---|---|---|
| `DataServiceApp` | «startup»: builds everything and starts the sync | M0, M2, M3 |
| `DataApiController` | 11 GET endpoints, with ETag, gzip and rate limit; `/api/taxi-stands` first | M2 |
| `ServerDataCache` | in-memory last good copy per `Dataset` | M2 |
| `DatasetAdapter` (interface) | declares its own source, path and refresh interval, and `prepare()`s raw data. `TaxiStandAdapter` is the first one; 2a adds four | M3; 2a |
| `SyncService` | `start()`: runs each adapter on its own interval, then `buildSuggestions()` | M3; suggestions in Phase 2 |
| `ExternalApiFacade` | `fetch(provider, path)`: LTA DataMall, data.gov.sg and OpenStreetMap Overpass, each with a timeout | M3; 2a |
| `ApiKeyStore` | keys from `.env` (only LTA needs one; no OneMap token, D14) | M3 |
| `Dataset`, `Provider` | server-side string unions | M2–M3 |
| `SuggestionStrategy` → `PickupSuggestionStrategy`, `RestStopSuggestionStrategy` | score sites from the cached data | Phase 2 |

**Shared, in `shared/src/` (`@taxisstant/shared`):** the zod schemas (`apiResponse(data)`, `ApiError`, the DTOs, starting with `TaxiStandDto`), the types inferred from them, and `ENDPOINTS`, the list of every endpoint with its path and response schema. Since package 1 it contains runtime code, but still needs no build step: Vite and `tsx` read its TypeScript directly.

**Tests** sit next to the code they test, named `*.test.ts` (or `*.test.tsx`).

**Layering rules:** each client layer only calls the layer below it. Views call controllers, and re-render when controller state changes. Controllers never call views.

---

## Phase 1 — Learning: UC 0001 "Toggle Taxi Stands", end to end ✅

UC 0001 runs through every part of the architecture once:

> LTA DataMall → TaxiStandAdapter → SyncService → ServerDataCache → DataApiController → DataApiClient → CacheManager → DataSyncController → MapDataRepository → MapDisplayController → MapView

**Who does what**

- **Claude sets up** the parts that are tedious and teach little:
  - installing packages
  - config files and scaffolding
  - test harnesses and sample data
  - each milestone's acceptance tests

  Each setup comes with a short explanation.
- **I write** everything listed under "I write". Claude writes the tests and I review them (my own extra test per milestone was dropped on 27 Oct, after M6).
- **Review:** Claude reviews my code and gives hints when I ask. Claude only writes my part if I ask for the answer.
- **Commits:** I commit at the end of each milestone.

### M0 — Project setup ✅
- [x] Already done by me: `git init`, `.gitignore`, the root `package.json` with workspaces, `tsconfig.base.json`, the `server` workspace
- [x] I wrote: `DataServiceApp.main()` logging its port; the `tsx`-vs-`tsc` experiment
- [x] Claude set up:
  - the server config, the client via create-vite, and one TypeScript 7 for the whole repo
  - `verbatimModuleSyntax` and `erasableSyntaxOnly`
  - Vitest in both workspaces
  - root `dev`, `test` and `typecheck` scripts
- [x] Done

### M1 — TypeScript through the domain objects (no React, no server) ✅
- **Learn:** types vs interfaces vs classes, union types, abstract classes and inheritance, implementing an interface, structural typing, generics, strict null checks, aliasing, writing tests.
- **Claude sets up:**
  - [x] acceptance tests (25, in `client/src/entity/*.test.ts`), checked against a reference solution kept outside the repo
- **I write**, in `client/src/entity/`:
  - [x] `LayerType`: a string union, derived from `LAYER_TYPES`
  - [x] `Location`: optional `address`, `distanceTo()` in metres, and a `RangeError` for impossible coordinates
  - [x] abstract `Landmark` → `TaxiStand`
  - [x] `Locatable` interface, implemented by `Landmark` through `getLocation()`
  - [x] `MapDataRepository`, which replaces my `LandmarkRepository.ts`:
    - `getByLayerType` and `replaceLayer`
    - stores `Locatable[]` per layer, copying the arrays on the way in and out
  - [x] my own test: the coordinate-limit boundaries
- **Done when:** `npm test` and `npm run typecheck` pass.
- [x] Done

### M2 — First backend: serve data over HTTP ✅
- **Learn:** HTTP requests and responses, routes, JSON, status codes, headers, middleware, `curl`.
- **Claude sets up:**
  - [x] Express 5 and Supertest installed
  - [x] `server/src/sample-data/taxi-stands.json` (6 made-up stands; deleted in M3 once real data arrived)
  - [x] acceptance tests (11, in `server/src/**/*.test.ts`), checked against a reference solution kept outside the repo
- **I write:**
  - [x] `DataServiceApp` grows into an Express app
  - [x] the `Dataset` union, starting with `"TAXI_STANDS"`
  - [x] `ServerDataCache`: `get(d)` and `put(d, data)`. `put` wraps the data in `ApiResponse<T>` (`{ asOf, etag, data }`) and computes the ETag.
  - [x] `DataApiController.getTaxiStands` at `GET /api/taxi-stands`, which answers:
    - 503 before any data exists
    - 304 when `If-None-Match` matches the ETag
    - otherwise 200 with the data
  - [x] a small logging middleware
  - [x] a JSON 404 for unknown `/api` paths (my addition)
  - [x] my own tests: 503 then 200 once data arrives, the 503 says why, the JSON 404
- **Done when:** `curl -i` shows a 200 then a 304, and the tests pass.
- [x] Done

### M3 — Real data on the server ✅
- **Learn:** async/await and Promises, `fetch`, error handling, environment variables and why secrets stay on the server (NF-2.2), checking untrusted JSON with zod, scheduled jobs.
- **Claude sets up:**
  - [x] zod installed
  - [x] `.env` loading (Node's built-in `--env-file-if-exists`) and `server/.env.example`
  - [x] a real LTA response recorded by me: `server/src/sample-data/lta-taxi-stands.raw.json` (316 stands, 26 Oct; committed after the M3 commit, as the tests need it)
  - [x] `server/src` reorganised by component (`api/`, `cache/`, `sync/`, `external/`, `contract/`)
  - [x] acceptance tests (32, in `server/src/**/*.test.ts`), checked against a reference solution and 5 deliberate bugs
- **I write:**
  - [x] the `Provider` union
  - [x] `ApiKeyStore`
  - [x] `ExternalApiFacade.fetch(provider, path)`: async, with the AccountKey header and paging
  - [x] `TaxiStandDto`, the `DatasetAdapter<T>` interface, and `TaxiStandAdapter`, which declares its source, path and interval and `prepare()`s the data, checked with zod
  - [x] `SyncService.start()`:
    - syncs every adapter once at startup, retrying failures
    - then runs each adapter on its own interval
    - `stop()`, to cancel the timers
  - [x] `DataServiceApp` swaps the sample file for the real sync
- **Needs:** my LTA DataMall AccountKey in `server/.env`.
- **Done when:**
  - the endpoint serves real taxi stands that refresh on a schedule
  - a failed fetch keeps the last good copy
- [x] Done: 316 real stands served on 26 Oct; failures and retries verified by tests and by a deliberately wrong key

### M4 — React basics: a map with a toggle ✅
- **Learn:** JSX, components, props, `useState`, event handlers, conditional rendering, lists and keys, `useEffect`, component tests.
- **Claude sets up:**
  - [x] Leaflet 1.9 and react-leaflet 5 installed, with the CSS and marker icons working (`boundary/leafletSetup.ts`)
  - [x] the OneMap tiles and attribution (`boundary/onemap.ts`)
  - [x] the Vite demo removed, basic mobile styles in `index.css`, and a placeholder `App.tsx`
  - [x] Testing Library, jest-dom and jsdom, set up in `vite.config.ts` and `src/test-setup.ts`
  - [x] acceptance tests (14, in `FilterTool.test.tsx`, `MapView.test.tsx`, `App.test.tsx`), checked against a reference solution and 2 classic React mistakes
- **I write**, in `client/src/boundary/` and `client/src/App.tsx`:
  - [x] `FilterTool`: one toggle per layer (mockup labels), `aria-pressed` on the ones that are on, `onToggle(t)` on click; white when inactive, highlighted when active
  - [x] `MapView`: a map centred on Singapore with OneMap tiles, and one marker per taxi stand, titled with its name
  - [x] `App`: owns which layers are on (`useState`), passes them down, and shows hard-coded `TaxiStand`s when Taxi stands is on
- **Done when:** toggling shows and hides the markers.
- [x] Done

### M5 — Connecting the frontend to the backend ✅
- **Learn:** same-origin and CORS, the Vite dev proxy, `fetch` in the browser, timeouts with `AbortController` (NF-3.1.1), loading and error states, union types for results, sharing a package between workspaces.
- **Claude sets up:**
  - [x] the `shared/` workspace (`@taxisstant/shared`, types only, no build step), linked into client and server
  - [x] acceptance tests (21 new client tests in `services/`, `boundary/Toast.test.tsx` and a new `App.test.tsx`; the cache test now imports from `@taxisstant/shared`), checked against a reference solution and 4 likely mistakes
- **I write:**
  - [x] move `TaxiStandDto` and `ApiResponse<T>` from `server/src/contract/` into `shared/`, and import them from `@taxisstant/shared` on both sides
  - [x] `DataApiClient.get(endpoint, etag)` in `client/src/services/`:
    - a 7-second timeout
    - returns either `ok` (with the body) or `not-modified`
  - [x] `toTaxiStand(dto)` in `client/src/services/`: plain JSON → a real `TaxiStand`
  - [x] `Toast` in `client/src/boundary/`: dismisses itself after 4 s (`useEffect` with cleanup)
  - [x] `App`: toggling Taxi stands on fetches the real stands once and shows them; a failure shows a toast and switches the toggle back
  - [x] the dev proxy in `client/vite.config.ts`, after seeing the CORS error for myself
- **Done when:** the real stands show on the map, and stopping the server gives the toast.
- [x] Done

### M6 — The layered architecture in React (the key lesson) ✅
- **Learn:**
  - why logic lives in control classes, not components
  - the Observer pattern (`DataSyncObserver`)
  - a `useSyncExternalStore` custom hook
  - dependency direction
  - React context
  - IndexedDB
- **Claude sets up:**
  - [x] idb and fake-indexeddb installed; every test starts with an empty in-memory IndexedDB (`test-setup.ts`)
  - [x] acceptance tests (46 new, replacing M5's `App` tests), checked against a reference solution and 7 likely mistakes
  - [x] fixed the M4 marker icons, which showed as broken images (Leaflet put its CSS-detected folder in front of our URLs); regression test in `boundary/leafletSetup.test.ts`
- **I write:**
  - [x] `control/Store.ts`: the Observer pattern (`subscribe`, `getSnapshot`, protected `setState`), no React
  - [x] `boundary/useStore.ts`: the hook that re-renders a component when a store changes (`useSyncExternalStore`)
  - [x] `services/LocalStore.ts`: `read` / `write` on IndexedDB through idb
  - [x] `entity/UserPreferences.ts` (only `visibleLayers` for now) and `isLayerType()` in `entity/LayerType.ts`
  - [x] `control/SettingsController.ts`: the only owner of which layers are visible; `load()` and `setLayerVisible()`, saved through `LocalStore`
  - [x] `control/DataSyncObserver.ts` and `control/DataSyncController.ts`: `refreshStatic()` (once per session, shared in-flight request) and `attach(observer)`; fills `MapDataRepository` and notifies observers
  - [x] `control/MapDisplayController.ts`, a `DataSyncObserver`: `toggleLayer`, `start`, `onDataUpdated`, `dismissNotice`; state `visible` + `notice` (D3)
  - [x] `startup.ts`: `initControllers()`, `startControllers()`, `ControllersContext`; `App` reads controllers from context; `main.tsx` wires it all up
- **Done when:**
  - the toggle state survives a reload
  - no component calls `fetch` or touches storage directly
- [x] Done: checked in Chrome on 27 Oct (on and off both survive a reload; junk in storage starts with everything off)

### M7 — Offline cache ✅
- **Learn:** caching strategies, staleness, ETag re-checks from the client, designing for offline use, async storage, testing with a fake IndexedDB.
- **Claude sets up:**
  - [x] acceptance tests (21 new: `services/CacheManager.test.ts`, and M7 tests added to the `DataSyncController`, `MapDisplayController` and `App` tests), checked against a reference solution and 17 likely mistakes
  - [x] how to simulate offline in Chrome (below)
- **I write:**
  - [x] `services/CacheManager.ts` on top of `LocalStore`: `get`, `put`, `isStale(key, ttlMs)`; saved as `cache:<key>` → `{ savedAt, response }`; damaged entries count as nothing saved; the clock is passed in, like `fetchFn`
  - [x] `DataSyncController` takes the `CacheManager` (D10); `loadCached()` fills `MapDataRepository` from the cache, without the network
  - [x] `refreshStatic()`: no network if checked within a day; otherwise re-check with `If-None-Match`. 200 → save and show; 304 → save again (checked today); failure → keep the saved copy, or reject if there is none
  - [x] `startup.ts`: create the `CacheManager`; `startControllers()` calls `loadCached()` between `settings.load()` and `mapDisplay.start()`
- **Simulating offline in Chrome** (both servers running):
  - *Server down:* stop the API server. Vite's proxy then answers 502, which the app treats like any failure.
  - *No data connection, app still opens:* DevTools → Network → right-click any `/api/` request → **Block request URL**. Reloads still load the app from Vite, but every API call fails.
  - *Device offline:* the Network tab's throttling menu → **Offline**, *after* the page has loaded. Reloading while offline can't fetch the app's own files; that needs a service worker (see "Decisions I'll be asked about").
  - *See the cache:* Application → IndexedDB → `taxisstant` → `keyval` → `cache:/taxi-stands`. The viewer can delete entries but not edit them.
  - *Force the daily re-check:* paste this into the Console, then reload. The Network tab shows `If-None-Match` and a 304.
    ```js
    const db = await new Promise((ok) => (indexedDB.open("taxisstant").onsuccess = (e) => ok(e.target.result)));
    const keyval = db.transaction("keyval", "readwrite").objectStore("keyval");
    keyval.get("cache:/taxi-stands").onsuccess = (e) => keyval.put({ ...e.target.result, savedAt: 0 }, "cache:/taxi-stands");
    ```
- **Done when** UC 0001 works as revised in D1:
  - after one online load, the taxi stands still toggle on with the server down or the device offline
  - with no cached copy and no connection, toggling shows the toast and switches back
- [x] Done: checked in Chrome on 27 Oct. **Phase 1 complete.**

---

## Phase 2 — Finishing: Claude builds the rest

**How checkpoints work.** Claude builds one work package at a time. Each one ends with:

- a demo: what to run and what to click
- a short walkthrough of the key code and design choices
- tests passing

I review and approve before the next package starts. Claude asks me whenever a decision comes up (see "Decisions I'll be asked about").

1. **Contract and tooling** ✅
   - [x] zod schemas in `shared/` replace the hand-written DTOs: types via `z.infer`, `ENDPOINTS` lists every endpoint (D11)
   - [x] `shared/openapi.json` generated from the schemas (`npm run openapi -w shared`), tested against the OpenAPI 3.1 schema and for being up to date
   - [x] the client checks every downloaded and cached response against its endpoint's schema; the server has a contract test on the real LTA data
   - [x] Prettier for the whole repo, and Oxlint extended to the server and `shared/`; `npm run check` runs type-check, lint, format check and all tests
2. **Map layers, built end to end** ✅ (decided 28 Oct: each checkpoint takes layers from the source to the map, so every one has a demo; this absorbs the old packages 4 and 5)
   - **2a. Static layers, server** ✅
     - [x] research: sources checked with real calls; decisions D12–D15
     - [x] `ExternalApiFacade`: one client per provider (LTA paging that keeps an existing query string, LTA download links, data.gov.sg poll-then-download, Overpass POST), with timeouts
     - [x] adapters, `ENDPOINTS` entries and routes for carparks (LTA, car lots only), hawker centres (NEA, D13), fuel stations (OpenStreetMap, D12) and charging stations (LTA EV batch, D15), refreshed daily
     - [x] adapters skip a few bad rows but reject a dataset whose format changed (the last good copy stays)
     - [x] recorded samples and contract tests for every endpoint
   - **2b. Static layers, client** ✅
     - [x] `DataSyncController`, `CacheManager` use and `MapDataRepository` generalised from taxi stands to every static layer; every static layer downloaded at startup (D18)
     - [x] `Carpark`, `FuelStation`, `ChargingStation`, `HawkerCentre` entities (`HawkerCentre.isOpen` in Singapore dates, D13); `MapDisplayController` for every layer, with each use case's toast
     - [x] `refreshVisible(viewport)`: only what's in view, clustered while zoomed out (D17)
     - [x] the mockup's markers per layer (Tabler icons, amber and green groups), a details popup per layer, and "© OpenStreetMap contributors" while Fuel is shown (D12)
     - [x] gzip on the server (moved forward from 2e): charging stations go out as 115 kB instead of 785 kB
   - **2c. Live layers, server** ✅
     - [x] the station file (`reference-data/train-stations.json`, 185 open stations) and its generator, `npm run build-stations -w server` (D14)
     - [x] `DatasetAdapter.getPaths()` (D21)
     - [x] taxis (data.gov.sg, one snapshot), carpark availability (LTA only, D19), charger availability (EV batch) and hotspots (real-time crowd density, D20)
     - [x] intervals: taxis every 30 s, carpark availability every minute and chargers every 5 minutes (LTA's own pace, within the diagram's 1–5), hotspots every 10 minutes (D20)
   - **2d. Live layers, client** ✅
     - [x] `Taxi`, `Site` → `Hotspot` entities; age limits per layer (D22)
     - [x] `DataSyncController.refreshLive(layers)` (suggestion `kinds` join in package 7) and `refreshLiveLayer(t)`; a 304 counts as confirmed now
     - [x] polling every 30 s, together, only what's on, paused in the background (D25); availability asked for as soon as Carpark or Charge is turned on
     - [x] `MapDataRepository.updateAvailability`; free lots and chargers in popups, "as of" their time
     - [x] taxis clustered (D24); busy stations as the mockup's heat circles (D23); UC 0002/0003 toasts
     - [x] the server retries a provider's hiccups quickly (D26)
   - **2e. HTTP hardening** ✅
     - [x] a rate limit of 300 requests a minute per client address, answering 429 with `Retry-After` (D27); 429 in the OpenAPI document
     - [x] a CORS allow-list from `CORS_ORIGINS`, empty by default (same origin); `TRUST_PROXY` for a reverse proxy; no `X-Powered-By`; `Cache-Control: no-cache`
     - [x] settings checked at startup (`ServerConfig.ts`); `.env.example` lists them (gzip moved to 2b)
3. **Suggested sites on the server (Strategy pattern)**
   - [x] `SuggestionStrategy` (`buildSites(cache)`, plus its output dataset and inputs) with `PickupSuggestionStrategy.calculateProbability` (D28) and `RestStopSuggestionStrategy.calculateAmenities` (D29)
   - [x] `SyncService.buildSuggestions()`: a strategy rebuilds whenever one of its inputs syncs
   - [x] the `/api/pickup-sites` and `/api/rest-stop-sites` endpoints, contract-tested on the real samples
6. **Location (UC 0013)** ✅
   - [x] `GPSInterface` (`watchPosition`), `LocationController` (`startTracking`, `getCurrentLocation`, `attach`) and `LocationObserver`; GPS paused in the background; only the last position kept (D32)
   - [x] the mockup's blue dot with its accuracy circle, grey when not live; the map centres once (D31)
   - [x] the crosshair button, lit when the driver is away from the middle of the screen (UC 0013 3a)
   - [x] the denied banner with steps for this phone's browser, and Try again (D30)
7. **Recommendations (UC 0008–0009)** ✅
   - [x] client data for suggestions: `SuggestedSite` → `SuggestedPickup` / `SuggestedRestStop`, `MapDataRepository.getSuggestions` / `replaceSuggestions`, `DataSyncObserver.onRecommendationUpdated` (D9); suggestions are live data, polled with the layers (`refreshLive(layers, kinds)`, D25) and fresh for 5 or 15 minutes (D36)
   - [x] `RecommendationController`: `toggle`, plus `rank()` by distance and preferences on the client (D34); re-ranked as the driver moves and new scores arrive; UC 0008/0009 toasts (2a, 4a)
   - [x] `Sidemenu.onToggleSuggestion`: the mockup's drawer, opened by its menu button (D33)
   - [x] `RecommendationCard`: the best 3, with distance; tapping one shows it on the map; numbered pins and areas on the map
   - [x] turning a suggestion on also turns on its related layers; off turns off only those (D35)
   - [x] fixed on the way: a 304 no longer makes an old copy look new (D37); markers' titles follow changes (D38)
8. **Navigation and bookmarks (UC 0011–0012)**
   - [ ] `NavigationController` and `NavigationGateway.openDeepLink`
   - [ ] Yes/No prompt with "Do not show again"
   - [ ] `BookmarkController`, `BookmarkList` and `BookmarkPanel`
9. **Settings (FR-2)**
   - [ ] EN/ZH language switch
   - [ ] vehicle type
   - [ ] font size
   - [ ] dark mode
   - [ ] every setting persisted
   - [ ] Help & Support page (from the dialog map)
10. **Hardening and deployment**
    - [ ] NFRs: toasts on every failure, timeouts, large icons with text labels
    - [ ] the mockup's layer tools: a bottom sheet with icon buttons that collapses to icons only (replaces M4's text row in `FilterTool`)
    - [ ] wider test coverage
    - [ ] HTTPS deployment. `shared/` has runtime code since package 1, so the server runs with `tsx` or gets bundled. Set `TRUST_PROXY` if a reverse proxy sits in front, and `CORS_ORIGINS` only if the app is hosted elsewhere (D27)

---

## Design decisions

### Already in the 23 Oct diagrams (fixed since the AI report)
- Each `DatasetAdapter` declares its own source, path and refresh interval.
- `DataSyncController.loadCached()` runs at startup, so the map works offline.
- `UserPreferences` has `fontSize`, `darkMode` and `activeSuggestions`.
- Vehicle type reaches the ranking through `rank(…, prefs)`.
- Taxis are stored in the repository as `Locatable`.
- `NavigationGateway` opens the deep link itself, and nothing calls `MapView`.
- `Bounds`, `Callback`, `DateTime`, `Duration`, `Json`, `Dataset` and `Provider` are defined in a note.

### Decisions the code adds on top of the diagrams
- **D1 — Freshness.**
  - Static layers are re-checked daily using ETags.
  - Live layers follow the 5-minute rule, and they're polled only while toggled on.
  - A toggle reads from `MapDataRepository`. The "Unable to load" exception only happens when there's no cached copy at all.
- **D2 — Sync.** The server syncs on its own schedule and is the only part that calls external APIs or holds keys. The client only ever talks to our server.
- **D3 — Notices.** `MapDisplayController` holds a `notice` that `MapView` shows as a toast, because controllers never call views and no class in the diagram holds error state. `SettingsController` owns the toggle state, as the diagram already shows.
- **D4 — Async I/O.**
  - Every network and storage call returns a `Promise`. The diagram writes them as plain return types, except `LocalStore`.
  - `DataApiClient.get` returns either `ok` with the body or `not-modified`.
- **D5 — Types.**
  - Use string unions instead of TS enums.
  - Make the adapter generic: `DatasetAdapter<T>`, with `prepare(raw: unknown): T`, checked with zod.
  - Use `ApiResponse<T>` everywhere, and no `Object` types.
- **D6 — Location.**
  - `address` is optional.
  - Distances are in metres.
  - JSON DTOs are converted into entity classes in one place, `DataSyncController`.
- **D7 — Server startup.**
  - The server syncs once at boot and retries failures.
  - It returns 503 only until the first successful sync.
  - If a later sync fails, it keeps the last good copy.
- **D8 — Visibility.**
  - Fields the diagram marks `#` (protected) or `-` (private) become `readonly` public fields when other layers need to read them, e.g. the map showing a landmark's `name`.
  - The diagram only defines `getLocation()` and `getType()`, with no getters for `id` or `name`.
- **D9 — Suggestion updates (my decision, 23 Oct).** `DataSyncObserver` gets a second method, `onRecommendationUpdated(k: RecommendationKind)`. `onDataUpdated(t: LayerType)` stays for map layers. Built in package 7 with both methods optional, so each observer implements what it listens to: `MapDisplayController` layers, `RecommendationController` suggestions. The design model's `RecommendationController.onDataUpdated(t)` isn't needed, because the server scores the sites from the layers. Added in Phase 2, package 7.
- **D10 — One `CacheManager`, passed in (my decision, 27 Oct).** The diagram marks `CacheManager` «Singleton». Instead, `initControllers()` creates exactly one and passes it to `DataSyncController`, like `LocalStore`. There is still only one instance, but the startup code guarantees it rather than a static `getInstance()`, so tests can use a fresh one and dependencies show in constructors.
- **D11 — The contract is zod, in `shared/` (my decision, 28 Oct).** The diagram generates TypeScript types *from* an OpenAPI spec. We go the other way: each response shape is written once as a zod schema in `shared/`, both sides infer their types from it, and the OpenAPI document is generated from the same schemas. One source of truth and no code-generation step for the code; the client also uses the schemas to check what it downloads and what it saved.
- **D12 — Fuel stations from OpenStreetMap (my decision, 28 Oct).** No official dataset lists retail stations (Singapore Customs' "licensed petroleum premises" is 21 depots, last updated 2012). OSM, through the Overpass API, has about 200 (Singapore has about 184), refreshed daily. This adds a fourth provider, `OSM_OVERPASS`, which the design doesn't have. OSM's licence (ODbL) requires "© OpenStreetMap contributors" on the map while the Fuel layer is on. Public Overpass servers are sometimes at capacity, so the sync relies on D7's retries and last good copy.
- **D13 — Hawker centres carry closure dates, not opening hours (my decision, 28 Oct).** Centres have no opening hours (stalls do). NEA's "Dates of Hawker Centres Closure" (data.gov.sg) lists every centre with its quarterly cleaning and other-works closures, so `HawkerCentre.operatingHours` becomes `closures`, and `isOpen(t)` means "not closed for cleaning or works on that day". Package 3's rest-stop scoring should skip a closed centre.
- **D14 — Station coordinates are a committed file; OneMap leaves the runtime (my decision, 28 Oct).** LTA's crowd data has station codes only. A dev script builds `train-stations.json` from LTA's station-code table joined with LTA's station-exit coordinates (data.gov.sg), with OneMap search for codes newer than the table. Regenerate it when a line opens. The server never calls OneMap, so `ApiKeyStore.oneMapToken` and `refreshOneMapToken` are dropped, and NF-2.2 (no expired-token problems) holds by construction. (OneMap search now warns that it will require a token.)
- **D15 — Charging stations: several operators, and charging speed (28 Oct).** 42 of 2,806 LTA locations have more than one operator, so `ChargingStation.operator: String` becomes `operators: string[]`. Added `maxPowerKw` and `hasDcFast`: an EV taxi mid-shift needs DC fast charging (50 kW+), which 620 locations have.
- **D16 — How adapters treat imperfect data (28 Oct, extends D7).** Real feeds have odd rows: 116 EV locations have no name, one carpark has no location. Adapters therefore skip rows that don't fit and log a warning, but reject the whole download when more than 5% of rows don't fit (the format changed) or when it is implausibly small (cut short or emptied). LTA's paged feeds also don't always come from one snapshot: on 28 Oct, for several minutes, rows shifted between pages, so 40 carparks came twice and 40 others went missing. `CarparkAdapter` accepts up to 1% repeated rows (keeping one of each) and rejects anything worse. A rejected download keeps the last good copy and retries a minute later (D7). The live LTA feeds in 2c need the same check. `TaxiStandAdapter` follows the same rule since 2a (it used to reject the whole dataset over one bad row).
- **D17 — Dense layers are clustered (my decision, 28 Oct).** With every layer on, the island has about 5,000 landmarks: slow on a phone, and unreadable. `MapDisplayController.refreshVisible` keeps what's in view and merges nearby markers into a bubble with the layer's icon and a count while zoomed out (Supercluster, radius 60 px); from zoom 17 every marker shows on its own, and tapping a bubble zooms to where it splits. This changes the design model's `refreshVisible(bounds)` and `MapView.onPan(bounds)` to take a viewport: the bounds plus the zoom (FR-1.5.3 says "moves or zooms"). Measured: 2,996 chargers and fuel stations drawn as 233 markers, repainted in 36 ms.
- **D18 — Every static layer is downloaded at startup (my decision, 28 Oct).** After `loadCached()`, `startControllers()` calls `DataSyncController.refreshStatic()`, which brings every static layer up to date in the background, re-checking daily. That way every layer works offline, even one never turned on while online (the "markers available offline" requirement of UC 0004–0007), and toggles are instant. It never shows a toast. A toggle calls the new `refreshLayer(t)` for its one layer, which shares a download already under way and rejects (the toast) only when there is nothing to show. Cost: about 190 kB once, gzipped.
- **D19 — Carpark availability from LTA only (my decision, 28 Oct).** LTA's feed gives free lots for every HDB, URA and LTA carpark; data.gov.sg would add total lots for HDB carparks only. `Carpark.totalLots` is optional ([0..1]) in the design, so it stays empty, and the diagram's data.gov.sg "HDB carpark availability" feed is not used.
- **D20 — Hotspots are real-time crowd levels (my decision, 28 Oct).** The documents say "crowd forecast" (FR-1.2.3, the data dictionary, the deployment diagram); we serve LTA's real-time platform crowd density instead (`PCDRealTime`, 10-minute slots, one request per train line), refreshed every 10 minutes rather than the diagram's 30. `Hotspot.validFrom`/`validTo` hold the slot. LTA publishes a slot only after it ends, so "real time" is the last completed slot, about 10–25 minutes old (seen on 28 Oct: at 21:08 the newest slot was 20:40–20:50); 2d decides how old a slot may be and still show. Package 3's pickup scoring uses the same real-time levels.
- **D21 — Adapters declare a list of paths (my decision, 28 Oct).** LTA's crowd API takes one train line per request, so `DatasetAdapter.getPath()` becomes `getPaths()`: SyncService makes one request per path and `prepare()` receives the answers in order. Most adapters have one path. If any request fails, the sync retries and the last good copy stays (D7).
- **D22 — How old live data may be (my decision, 28 Oct).** UC 0002/0003 want the cache "not older than 5 minutes" and the app online; the deployment note keeps stale data for offline use. Each live layer gets a limit: taxis 5 minutes (the use cases), carpark and charger availability 15 minutes, hotspots whose slot ended up to 30 minutes ago (LTA's slots run 10–25 minutes late, D20). Older counts as nothing to show: toggling then gives the use case's toast and switches back (exception 4a). Popups say how old live figures are ("as of 20:50"). This reads D1's "5-minute rule" as the taxis' age limit, not a polling interval.
- **D23 — Only busy stations are hotspots (my decision, 28 Oct).** Stations at MEDIUM or HIGH get the mockup's heat circle (HIGH larger and stronger); LOW stations aren't drawn. At 21:08 on 28 Oct, 183 of 185 stations were LOW.
- **D24 — Nearby taxis are clustered (my decision, 28 Oct).** FR-1.2.2's "location and density" comes from D17's clusters: bubbles with counts when zoomed out, the mockup's amber car marker per taxi when zoomed in.
- **D25 — Live layers are polled every 30 seconds, together (my decision, 28 Oct).** One timer asks for every live layer that's on (and for carpark and charger availability while those layers are on), as the deployment note says; unchanged data answers 304. The timer stops while the app is in the background or no live layer is on. Taxis cost about 1.4 MB an hour while shown.
- **D26 — Quick retries for providers' hiccups (28 Oct, extends D7).** On 28 Oct, LTA's crowd API answered 500 on four syncs running, so hotspots took four minutes to appear after a server start; LTA's EV file and Overpass had one-off 500s and 502s too. `ExternalApiFacade` now retries a request that hit a server error (5xx) or a dropped connection after 1 s and again after 3 s, before the sync fails and waits its minute (D7). Answers the provider means (404, 429 "too busy") and timeouts aren't retried.
- **D27 — Rate limit and CORS (my decision, 28 Oct).** The design model's `DataApiController -rateLimiter` allows each client address 300 requests a minute (`RATE_LIMIT_PER_MINUTE`): one phone uses about 10–15, and mobile carriers put many phones behind one address. Over it, the answer is 429 with `Retry-After`, and the client falls back to its saved copy (D1, D22). The deployment diagram's "CORS allow-list" is `CORS_ORIGINS`, empty by default, because the plan is for the server to also host the app (one origin, so no CORS headers at all); a separate frontend host would be listed there. Behind a reverse proxy, `TRUST_PROXY` lets the limit see each client's own address; without it, `X-Forwarded-For` is ignored so clients can't fake their way past the limit.
- **D28 — How pickup spots are scored (my decision, 28 Oct).** `PickupSuggestionStrategy` scores every taxi stand (where pickups can legally happen): *demand* is the busiest station within 500 m (HIGH 1, MEDIUM 0.6, LOW 0.25, no station 0.1); *competition* is 1 + (empty taxis within 300 m) ÷ 5; `calculateProbability` = demand ÷ competition, between 0 and 1. Crowd levels older than D22's limit and taxi positions over 5 minutes old are left out. FR-1.3.1 says "high taxi density" counts in favour; but the taxi data counts empty taxis, and empty taxis waiting nearby are competition, so they count against.
- **D29 — How rest stops are scored (my decision, 28 Oct).** `RestStopSuggestionStrategy` scores every hawker centre not closed today (D13) that has cooked food (wet markets with no food stalls are left out): `calculateAmenities` = ½ × food choice (cooked-food stalls ÷ 60, capped at 1) + ½ × parking (the best carpark within 500 m: free lots ÷ 50, capped at 1, or 0.5 when its lots aren't known). First built as food 1 plus parking, it gave all 119 open centres 1.00 on real data (parking near hawker centres is never scarce: even the worst-off tenth have about 87 free lots nearby), so food choice was added on 28 Oct. `hasFuel` and `hasCharging` say what's within 500 m but aren't scored: only the client knows the vehicle type, so `rank(…, prefs)` uses them (FR-2.1.1, package 7).
- **D30 — When location is denied (my decision, 28 Oct).** UC 0013 wants an "actionable banner" that takes the driver "directly to OS app settings", but a web app can't open the phone's or the browser's settings, and once denied it can't even ask again. The banner keeps the use case's text; its button shows the steps for this phone's browser (iPhone Safari, Android Chrome, others), next to "Try again". The driver's dot turns grey, as specified.
- **D31 — The map centres on the driver once (my decision, 28 Oct).** On the session's first fix the map centres on the driver; after that it never moves by itself. UC 0013 step 3 says the map keeps the driver in view; instead, the crosshair button lights up whenever the driver's dot is away from the middle of the screen, whether the driver panned away (3a) or the taxi drove off, and tapping it re-centres.
- **D32 — Only the last position is kept (my decision, 28 Oct).** UC 0013's postcondition stores the location locally: only the latest fix (no history) goes into IndexedDB on the phone, so the map opens where the driver was and package 7 can rank suggestions before the GPS answers. It never leaves the phone, as the deployment diagram says. The design model's `TaxiDriver` (`driverId`, `currentLocation`) becomes `LocationController`'s state: with no user accounts, there is no driver id.
- **D33 — A suggestion is a toggle and a list (my decision, 29 Oct).** UC 0008/0009 make suggestions map toggles; the dialog map makes them a list sorted by proximity, where choosing one shows it on the map. Both: in the side menu (the mockup's drawer, "Smart suggestions"), each suggestion is a persisted toggle (UC, design note) that draws the best nearby sites as circles (amber for pickup, green for rest stops, as the data dictionary colours them) and lists them as `RecommendationCard`s; tapping a card shows the site on the map (dialog map, `MapDisplayController.focusOn`).
- **D34 — How suggestions are ranked (my decision, 29 Oct).** `RecommendationController.rank(sites, from, prefs)` keeps sites within 3 km (pickup) or 5 km (rest stop) of the driver, ranks them by score × 1/(1 + km/1.5), with a rest stop that has the driver's energy stop (vehicle type, package 9) counting ×1.25, and shows the top 3 (NF-1: few enough to read at a glance). With none nearby, or no position to rank from, the toggle gives UC 0008/0009's exception 4a toast and switches back.
- **D35 — Turning a suggestion off undoes only what it turned on (my decision, 29 Oct).** Turning a suggestion on turns its related layers on (UC 0008/0009 step 5: Charge, Fuel, Carpark, Hawker food; or Taxi stands, Nearby taxis, Hotspots). Turning it off turns off only the layers it switched on, not ones the driver already had on (UC 0008's alternative flow turns them all off).

---

- **D36 — How old suggestions may be (Claude's decision at my request, 29 Oct).** A suggested site counts only while it is as fresh as the live data it was scored from (D22): pickups 5 minutes (taxis; also UC 0008/0009's "not older than 5 minutes"), rest stops 15 minutes (free lots). Older sites are not suggested: a toggle gives exception 2a, and a list that ages out says it is out of date. The use cases conflict here: their precondition says 5 minutes, and their special requirement wants the markers offline. Rest stops keep 15 minutes rather than lasting offline, because a saved copy's free lots would be stale.
- **D37 — A 304 says how old the server's copy is (fix, 29 Oct).** Since 2d, a 304 made the client's copy count as confirmed "now". But a server whose source is down keeps its old copy, and with it the same ETag, so 20-minute-old taxis could show as current, against D22. The server now sends `Last-Modified` (the copy's `asOf`) on every answer, 304 included. The client keeps that time, never moving it backwards. Live data that is already too old when it arrives is stored but counts as nothing to show, so its toggle gives the "Unable to load" toast instead of an empty layer.
- **D38 — Markers' titles follow changes (fix, 29 Oct).** react-leaflet sets a marker's `title` (its tooltip and screen-reader name) only when it creates the marker. So since 2b/2d/6, a cluster bubble kept its old count, a hotspot its old crowd level, and the driver's dot "You are here" after the GPS went quiet. `TitledMarker` keeps every marker's title current. Found in package 7, where re-ranked pins kept their old numbers.

## Decisions I'll be asked about

| When | Decision |
|---|---|
| Package 8 | `Bookmark` has no `id` and holds the whole `Landmark`, yet `BookmarkList.remove(id)` needs an id. Should bookmarks get an `id` and store a `landmarkId`? |
| Package 10 | How to get access to the school lab server, and whether it can serve HTTPS. |
| Package 10 | Should the app itself open with no connection (a service worker)? M7 caches the *data*; the page's own files still come from the server. |

## Things I need to do
- [x] Register for an LTA DataMall AccountKey before M3. It's sent by email, which can take a while.
- [ ] Register for a OneMap account before Phase 2.
- [ ] Optional: a data.gov.sg API key, which raises the rate limit.
- [ ] Push the 23 Oct `.drawio` files and PNGs to the team repo, so the repo matches the design.

## Doc errors to raise with the team
- **Diagrams vs report:** the team repo's PNGs (15 Oct) don't match the current `.drawio` files.
- **UC 0008/0009 (and FR-1.3) are now out of date:** they say the client calculates suggestions from amenities and probabilities. The 23 Oct design has the server score them and the client only rank them.
- **The data dictionary swaps the definitions** of *Suggested Pickup* and *Suggested Rest Stop*.
- **FR-1.3.1 counts "high taxi density" in favour of a pickup spot,** but the taxi data counts empty taxis, which are competition (D28). No formula is given anywhere for `calculateProbability` or `calculateAmenities` (D28, D29).
- **UC 0001 and UC 0004–0007 contradict themselves twice:**
  - The "cache under 5 minutes" precondition clashes with their own note that the data is static.
  - "Markers available offline" clashes with the exception "fails to retrieve from the server".
- **UC 0010 mixes up two jobs:** the server's scheduled sync and the client's refresh. It also has the client holding API credentials.
- **UC 0009 has copy-paste errors:** pickup probability is "based on nearby amenities", and its exceptions mention rest stops.
- **The deployment diagram is out of date:** it still says the framework ("e.g. Next.js / React") and the host are undecided.
- **`Location.address` is a required `String`** in the diagram, but taxis, hotspots and suggested sites have no address.
- **The design model has no fuel-station source** (D12), and `HawkerCentre.operatingHours` has no data behind it (D13).
- **`ChargingStation.operator` is a single string**, but some locations have several operators (D15).
- **`DatasetAdapter` declares one source and one path,** while the diagram's own note says adapters "convert · join · clean". Settled by D19 (no join for carparks) and D21 (several paths).
- **Hotspots are described as a forecast** (FR-1.2.3, data dictionary, deployment diagram: "station crowd forecast", every 30 min); the app shows real-time levels every 10 min (D20).
- **The deployment diagram's data.gov.sg "HDB carpark availability"** isn't used: LTA covers every agency (D19).
- **UC 0013's exception sends the driver to OS app settings,** which a web app can't open (D30). Its step 3 keeps the map on the driver; the app centres once (D31).
- **`TaxiDriver.driverId`** has no meaning without user accounts, which the design rules out (D32).
- **UC 0008/0009 contradict themselves** like UC 0001: the "not older than 5 minutes" precondition, against "markers available offline" (D36). UC 0009's 2a toast says "rest stop markers"; the app says "pickup markers".
- **The dialog map shows suggestions as a list screen; UC 0008/0009 as map toggles** (D33). Its Settings UI has a "narrator on/off" option that no other document mentions (package 9).
- **The mockup calls the app "TaxiMate"**; the app keeps the name "Taxi Assistant", as in its page title (decided 29 Oct).
- **The AI report and the Lab 3 report number the use cases differently.** This plan uses the Lab 3 report's numbering.
