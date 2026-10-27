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
- **Contract:** shared TypeScript types in `shared/`. In Phase 2 these get generated from zod schemas via OpenAPI.
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
| | | abstract `Landmark` → `TaxiStand` | M1 |
| | | **`MapDataRepository`** («container»): `getByLayerType`, `replaceLayer` | M1 |
| | | `MapDataRepository`: `updateAvailability`, `getSuggestions`, `replaceSuggestions` | Phase 2 |
| | | `Carpark`, `FuelStation`, `ChargingStation`, `HawkerCentre` (Landmarks) | Phase 2 |
| | | `Taxi` (Locatable) | Phase 2 |
| | | abstract `Site` → `Hotspot`; abstract `SuggestedSite` → `SuggestedPickup`, `SuggestedRestStop` | Phase 2 |
| | | `UserPreferences`, `Bookmark`, `BookmarkList`, `TaxiDriver` | M6 / Phase 2 |
| | | `Language`, `VehicleType`, `RecommendationKind`, `DensityLevel` | when needed |
| `services/` | Data access & device services | `DataApiClient` | M5 |
| | | `LocalStore` | M6 |
| | | `CacheManager` | M7 |
| | | `GPSInterface`, `NavigationGateway` | Phase 2 |
| `control/` | Application logic | `MapDisplayController`, `SettingsController`, `DataSyncController` | M6 |
| | | `DataSyncObserver`, `LocationObserver` (interfaces) | M6 / Phase 2 |
| | | `LocationController`, `NavigationController`, `RecommendationController`, `BookmarkController` | Phase 2 |
| `boundary/` | Presentation (React) | `MapView`, `FilterTool` | M4 |
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
├── sync/                    SyncService, DatasetAdapter
│   ├── adapters/            TaxiStandAdapter (+ Phase 2 adapters)
│   └── strategies/          Phase 2: SuggestionStrategy and its two strategies
├── external/                ExternalApiFacade, ApiKeyStore, Provider
└── sample-data/             test fixtures, including the recorded LTA response
```


| Class | Role | Built in |
|---|---|---|
| `DataServiceApp` | «startup»: builds everything and starts the sync | M0, M2, M3 |
| `DataApiController` | 11 GET endpoints, with ETag, gzip and rate limit; `/api/taxi-stands` first | M2 |
| `ServerDataCache` | in-memory last good copy per `Dataset` | M2 |
| `DatasetAdapter` (interface) | declares its own source, path and refresh interval, and `prepare()`s raw data. `TaxiStandAdapter` is the first one | M3 |
| `SyncService` | `start()`: runs each adapter on its own interval, then `buildSuggestions()` | M3; suggestions in Phase 2 |
| `ExternalApiFacade` | `fetch(provider, path)` | M3 |
| `ApiKeyStore` | keys from `.env`, plus the OneMap token | M3 |
| `Dataset`, `Provider` | server-side string unions | M2–M3 |
| `SuggestionStrategy` → `PickupSuggestionStrategy`, `RestStopSuggestionStrategy` | score sites from the cached data | Phase 2 |

**Shared, in `shared/src/` (`@taxisstant/shared`):** `ApiResponse<T>` and the DTO types, starting with `TaxiStandDto` (moved there from `server/src/contract/` in M5). Types only, so no build step.

**Tests** sit next to the code they test, named `*.test.ts` (or `*.test.tsx`).

**Layering rules:** each client layer only calls the layer below it. Views call controllers, and re-render when controller state changes. Controllers never call views.

---

## Phase 1 — Learning: UC 0001 "Toggle Taxi Stands", end to end

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

### M7 — Offline cache
- **Learn:** caching strategies, staleness, ETag re-checks from the client, designing for offline use, async storage, testing with a fake IndexedDB.
- **Claude sets up:** acceptance tests, plus instructions for simulating offline in Chrome DevTools.
- **I write:**
  - `CacheManager` on top of `LocalStore`, with async `get`, `put` and `isStale`
  - `DataSyncController.loadCached()`, called by `App` at startup, which fills `MapDataRepository` from the cache
  - `refreshStatic()` re-checks with `If-None-Match` once a day
- **Done when** UC 0001 works as revised in D1:
  - after one online load, the taxi stands still toggle on with the server down or the device offline
  - with no cached copy and no connection, toggling shows the toast and switches back
- [ ] Done

---

## Phase 2 — Finishing: Claude builds the rest

**How checkpoints work.** Claude builds one work package at a time. Each one ends with:

- a demo: what to run and what to click
- a short walkthrough of the key code and design choices
- tests passing

I review and approve before the next package starts. Claude asks me whenever a decision comes up (see "Decisions I'll be asked about").

1. **Contract and tooling**
   - [ ] zod schemas → OpenAPI → generated types in `shared/`, replacing the hand-written DTOs
   - [ ] Prettier, and Oxlint (already set up in the client by the Vite template) extended to the server
2. **Server data**
   - [ ] adapters for the other 4 static endpoints (carparks, hawker centres, fuel stations, charging stations)
   - [ ] adapters for the live endpoints: taxis, carpark availability, charger availability, hotspots
   - [ ] intervals from the deployment diagram:
     - taxis every 30 s
     - availability every 1–5 min
     - hotspots every 30 min
     - static data daily
   - [ ] gzip, rate limiting and a CORS allow-list
   - [ ] OneMap token refresh
3. **Suggested sites on the server (Strategy pattern)**
   - [ ] `SuggestionStrategy` with `PickupSuggestionStrategy.calculateProbability` and `RestStopSuggestionStrategy.calculateAmenities`
   - [ ] `SyncService.buildSuggestions()`
   - [ ] the `/api/pickup-sites` and `/api/rest-stop-sites` endpoints
4. **Client data layer for every endpoint**
   - [ ] caching and daily re-checks for every static endpoint
   - [ ] `refreshLive(layers, kinds)`, polling only what's toggled on
   - [ ] pausing when the app is in the background
   - [ ] `MapDataRepository.updateAvailability` and the suggestion methods
5. **Map layers (UC 0002–0007)**
   - [ ] the other 4 Landmark types, `Taxi`, and `Site` → `Hotspot`
   - [ ] taxis shown with clustering or density
   - [ ] hotspots and suggestions drawn as circles
   - [ ] vehicle type hides irrelevant energy stops (FR-2.1.1)
6. **Location (UC 0013)**
   - [ ] `GPSInterface`, `LocationController` and `LocationObserver`
   - [ ] driver pin
   - [ ] re-centre button
   - [ ] banner when location permission is denied
7. **Recommendations (UC 0008–0009)**
   - [ ] `RecommendationController`: `toggle`, plus `rank()` by distance and preferences on the client
   - [ ] `Sidemenu.onToggleSuggestion`
   - [ ] `RecommendationCard`
   - [ ] turning a suggestion on also turns on its related layers
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
    - [ ] wider test coverage
    - [ ] HTTPS deployment

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
- **D9 — Suggestion updates (my decision, 23 Oct).** `DataSyncObserver` gets a second method, `onRecommendationUpdated(k: RecommendationKind)`. `onDataUpdated(t: LayerType)` stays for map layers. Added in Phase 2, package 4.
- **D10 — One `CacheManager`, passed in (my decision, 27 Oct).** The diagram marks `CacheManager` «Singleton». Instead, `initControllers()` creates exactly one and passes it to `DataSyncController`, like `LocalStore`. There is still only one instance, but the startup code guarantees it rather than a static `getInstance()`, so tests can use a fresh one and dependencies show in constructors.

---

## Decisions I'll be asked about

| When | Decision |
|---|---|
| Package 2 | Which fuel-station data source to use (still undecided). |
| Package 2 | Where hotspot coordinates come from. LTA's crowd forecast gives MRT *station names*, but `Hotspot` is a `Site` with a `centre`, so the station coordinates need another source. |
| Package 3 | How to score pickup spots and rest stops (`calculateProbability`, `calculateAmenities`). |
| Package 8 | `Bookmark` has no `id` and holds the whole `Landmark`, yet `BookmarkList.remove(id)` needs an id. Should bookmarks get an `id` and store a `landmarkId`? |
| Package 10 | How to get access to the school lab server, and whether it can serve HTTPS. |

## Things I need to do
- [x] Register for an LTA DataMall AccountKey before M3. It's sent by email, which can take a while.
- [ ] Register for a OneMap account before Phase 2.
- [ ] Optional: a data.gov.sg API key, which raises the rate limit.
- [ ] Push the 23 Oct `.drawio` files and PNGs to the team repo, so the repo matches the design.

## Doc errors to raise with the team
- **Diagrams vs report:** the team repo's PNGs (15 Oct) don't match the current `.drawio` files.
- **UC 0008/0009 (and FR-1.3) are now out of date:** they say the client calculates suggestions from amenities and probabilities. The 23 Oct design has the server score them and the client only rank them.
- **The data dictionary swaps the definitions** of *Suggested Pickup* and *Suggested Rest Stop*.
- **UC 0001 and UC 0004–0007 contradict themselves twice:**
  - The "cache under 5 minutes" precondition clashes with their own note that the data is static.
  - "Markers available offline" clashes with the exception "fails to retrieve from the server".
- **UC 0010 mixes up two jobs:** the server's scheduled sync and the client's refresh. It also has the client holding API credentials.
- **UC 0009 has copy-paste errors:** pickup probability is "based on nearby amenities", and its exceptions mention rest stops.
- **The deployment diagram is out of date:** it still says the framework ("e.g. Next.js / React") and the host are undecided.
- **`Location.address` is a required `String`** in the diagram, but taxis, hotspots and suggested sites have no address.
- **The AI report and the Lab 3 report number the use cases differently.** This plan uses the Lab 3 report's numbering.
