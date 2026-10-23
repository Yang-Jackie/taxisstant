# Taxi Assistant — Build Plan

A mobile-layout web app for Singapore taxi drivers, built from the SC2006 team's Lab 1–3 design
([softwarelab3/2006-SCSC-F2](https://github.com/softwarelab3/2006-SCSC-F2)).

The build starts from an empty folder and has two phases:

- **Phase 1 (learning):** I hand-code one feature, UC 0001 "Toggle Taxi Stands", through every layer of the architecture. Claude handles the setup and tooling that teach little.
- **Phase 2 (finishing):** Claude builds the rest of the app one work package at a time, and I review each package at a checkpoint.

I'm the only one writing code, so Phase 2 covers the whole app. Nothing is copied from the team's AI-generated skeleton (`lab3/Skeleton`). The spec is the design documents themselves.

## Sources

| What | Where (team repo) |
|---|---|
| Use cases UC 0001–0013, FR/NFR, data dictionary | `lab3/Lab 3 Report.pdf` |
| Tech stack and the team's critique of the design | `lab3/Lab 3 - AI Report.pdf` |
| Design model (class diagram) | `lab3/Diagrams/Lab3_DesignModel.png` |
| Layered and deployment architecture | `lab3/Diagrams/Lab3_SystemArchitecture-*.png` |
| Dialog map (screen flow) | `lab3/Diagrams/dialog map.png` |

## Stack (decided in Lab 3)

- **Monorepo:** npm workspaces with `client/`, `server/` and `shared/`, all under the `@taxisstant/` package scope
- **Client:** React, TypeScript, Vite, react-leaflet with OneMap tiles, IndexedDB (`idb`), i18next (EN/ZH)
- **Server:** Node, Express and TypeScript; node-cron for the scheduled sync; an in-memory cache and no database; API keys kept in `.env`
- **Contract:** shared TypeScript types in `shared/`. In Phase 2 these get generated from zod schemas via OpenAPI.
- **Tests:** Vitest, Supertest, Testing Library, fake-indexeddb
- **TypeScript 7:** `strict` is on by default, and `@types` packages are only loaded when listed in `types`.

## Project layout

```
taxisstant/
├── package.json        root: workspaces and scripts
├── server/             Express data service
│   └── src/            startup, API controller, cache, sync, facade, adapters
├── client/             React app, scaffolded with create-vite
│   └── src/
│       ├── entity/     domain classes: Landmark, TaxiStand, …             (M1)
│       ├── boundary/   React components: MapView, FilterTool, …           (M4)
│       ├── services/   DataApiClient, LocalStore, CacheManager, …         (M5–M7)
│       └── control/    controllers: MapDisplayController, …               (M6)
└── shared/             types used by both client and server               (M5)
```

The client has four layers, matching the layered architecture diagram:

- boundary: what the user sees
- control: application logic
- entity: domain objects
- services: data access and device services

Each layer only calls the layer below it.

Tests sit next to the code they test, named `*.test.ts` (or `*.test.tsx`).

`boundary/` holds React components only. The design model also labels `DataApiClient`, `GPSInterface` and `NavigationGateway` as «boundary», because they talk to outside systems. The architecture diagram puts them in the bottom layer, so they go in `services/`.

---

## Phase 1 — Learning: UC 0001 "Toggle Taxi Stands", end to end

UC 0001 runs through every part of the architecture once:

> LTA DataMall → adapter → scheduled sync → server cache → REST endpoint → API client → offline cache → controller → repository → React view

After that, most of the app is the same pattern repeated, plus the recommendation algorithms.

**Who does what**

- **Claude sets up** the parts that are tedious and teach little:
  - installing packages
  - config files and scaffolding
  - test harnesses and sample data
  - each milestone's acceptance tests

  Each setup comes with a short explanation, so nothing is magic.
- **I write** everything listed under "I write", because that's where the learning is. I also write at least one extra test of my own per milestone.
- **Review:** Claude reviews my code like a PR and gives hints when I ask. Claude only writes my part if I ask for the answer.
- **Commits:** I commit at the end of each milestone.

### M0 — Project setup
- **Learn:** npm and `package.json`, workspaces, dependencies vs devDependencies, `tsc` vs `tsx`, ES modules, tsconfig basics.
- **Already done:**
  - [x] `git init` and `.gitignore`
  - [x] root `package.json` with workspaces, plus TypeScript and Vitest
  - [x] `tsconfig.base.json` and the `server` workspace
- **I write:**
  - [ ] `server/src/DataServiceApp.ts`: a «startup» class with a static `main()` that logs its port
  - [ ] the `tsx`-vs-`tsc` experiment: a type error that `tsx` runs anyway and `tsc` catches
- **Claude sets up:**
  - [x] the rest of the server config:
    - `rootDir`, `outDir` and `include`
    - move `types: ["node"]` from the base config to the server, because browser code must not see Node's types
    - install `tsx`, and `@types/node` pinned to 24 to match the installed Node
  - [x] the `client` workspace via create-vite (React + TS):
    - its tsconfigs extend `tsconfig.base.json`
    - the template's own TypeScript 6 was removed, so the whole repo uses one TypeScript 7
  - [x] `verbatimModuleSyntax` and `erasableSyntaxOnly` in the base config, so client and server follow the same TypeScript rules
  - [x] Vitest in both workspaces
  - [x] root scripts: `dev` (client and server together via `concurrently`), `test`, `typecheck`
- **Done when:**
  - `npm run dev` starts both client and server
  - `npm test` and `npm run typecheck` pass
  - the first commit is made
- [ ] Done

### M1 — TypeScript through the entity classes (no React, no server)
- **Learn:** types vs interfaces vs classes, union types, abstract classes and inheritance, generics, strict null checks, writing tests.
- **Claude sets up:** acceptance tests for the entity classes.
- **I write**, in `client/src/entity/`:
  - `LayerType` as a string union
  - `Location` with an optional `address`, and `distanceTo()` in metres (haversine)
  - abstract `Landmark` → `TaxiStand`
  - `LandmarkRepository` with:
    - `getByType` and `replace`
    - `findNear`: radius in metres, nearest first
- **Done when:** the acceptance tests and my own test pass.
- [ ] Done

### M2 — First backend: serve data over HTTP
- **Learn:** HTTP requests and responses, routes, JSON, status codes, headers, middleware, `curl`.
- **Claude sets up:** Express and Supertest installed, a sample taxi-stand JSON file, and acceptance tests.
- **I write:**
  - `DataServiceApp` grows into an Express app
  - `ServerDataCache`: a `Map` that stores `ApiResponse<T>` (`{ asOf, etag, data }`) and computes the ETag on `put`
  - `DataApiController` with `GET /api/taxi-stands`, which answers:
    - 503 before any data exists
    - 304 when `If-None-Match` matches the ETag
    - otherwise 200 with the data
  - a small logging middleware
- **Done when:** `curl -i` shows a 200 then a 304, and the tests pass.
- [ ] Done

### M3 — Real data on the server
- **Learn:** async/await and Promises, `fetch`, error handling, environment variables and why secrets stay on the server (NF-2.2), checking untrusted JSON with zod, scheduled jobs.
- **Claude sets up:**
  - zod and node-cron installed
  - `.env` loading and `.env.example`
  - a recorded LTA response to test against
  - acceptance tests
- **I write:**
  - `ApiKeyStore`
  - `ExternalApiFacade.fetch()` calling LTA DataMall: async, with the AccountKey header and paging
  - a generic `DatasetAdapter<T>`, and `TaxiStandAdapter` that checks the raw data with zod
  - `SyncService`:
    - syncs once at startup and retries if that fails
    - then runs on a node-cron schedule
- **Needs:** my LTA DataMall AccountKey in `server/.env`.
- **Done when:**
  - the endpoint serves real taxi stands that refresh on a schedule
  - a failed fetch keeps the last good copy
- [ ] Done

### M4 — React basics: a map with a toggle
- **Learn:** JSX, components, props, `useState`, event handlers, conditional rendering, lists and keys, `useEffect`, component tests.
- **Claude sets up:**
  - Leaflet and react-leaflet installed, with the CSS and marker icons working
  - the OneMap tile URL and attribution
  - the Vite demo removed and basic mobile styles added
  - Testing Library
- **I write**, in `client/src/boundary/`:
  - `App` → `MapView`: a map centred on Singapore with OneMap tiles
  - `FilterTool` with a Taxi Stands toggle: white background when inactive, highlighted when active (per the data dictionary)
  - markers from a hard-coded list
  - one component test
- **Done when:** toggling shows and hides the markers.
- [ ] Done

### M5 — Connecting the frontend to the backend
- **Learn:** same-origin and CORS, the Vite dev proxy, `fetch` in the browser, timeouts with `AbortController` (NF-3.1.1), loading and error states, union types for results, sharing a package between workspaces.
- **Claude sets up:** the `shared/` workspace's plumbing (its `package.json`, tsconfig, and links to client and server), plus acceptance tests.
- **I write:**
  - `TaxiStandDto` and `ApiResponse<T>` in `shared/`, used by both sides
  - `DataApiClient.get()` in `client/src/services/`:
    - a 7-second timeout
    - returns either `ok` (with the body) or `not-modified`
  - converting DTOs (plain JSON) into entity class instances
  - the dev proxy, after seeing the CORS error for myself
  - toggling on fetches the real stands and shows them; a failure shows a toast and switches the toggle back
- **Done when:** the real stands show on the map, and stopping the server gives the toast.
- [ ] Done

### M6 — The layered architecture in React (the key lesson)
- **Learn:**
  - why logic lives in control classes, not components
  - the Observer pattern
  - a `useSyncExternalStore` custom hook
  - dependency direction: views call controllers; lower layers never call upward
  - React context
  - IndexedDB
- **Claude sets up:** idb and fake-indexeddb installed, plus acceptance tests.
- **I write:**
  - `LocalStore`, a wrapper around idb, in `services/`
  - `SettingsController`: the only owner of which layers are visible, saved through `LocalStore`
  - `MapDisplayController`:
    - `toggleLayer`
    - the visible items
    - a `notice` that `MapView` shows as a toast
  - `DataSyncController`: loads data into `LandmarkRepository` and notifies observers
  - a hook that re-renders components when a controller changes
  - `App` wiring: create the services and controllers once and provide them through React context
- **Done when:**
  - the toggle state survives a reload
  - no component calls `fetch` or touches storage directly
- [ ] Done

### M7 — Offline cache
- **Learn:** caching strategies, staleness, ETag re-checks from the client, designing for offline use, async storage, testing with a fake IndexedDB.
- **Claude sets up:** acceptance tests, plus instructions for simulating offline in Chrome DevTools.
- **I write:**
  - `CacheManager` on top of `LocalStore`, with async `get`, `put` and `isStale`
  - `DataSyncController` at startup:
    - loads from the cache first
    - re-checks static data with `If-None-Match` once a day
- **Done when** UC 0001 works as revised in decision D1:
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
   - [ ] the remaining adapters: taxi availability, HDB carpark availability, hawker centres, LTA carparks, EV charging and charger availability, crowd forecast, fuel stations
   - [ ] sync schedules from the deployment diagram:
     - taxis every 30 s
     - availability every 1–5 min
     - crowd forecast every 30 min
     - static data daily
   - [ ] `RestStopSite` precomputation
   - [ ] all 10 endpoints, with gzip, rate limiting and a CORS allow-list
   - [ ] OneMap token refresh
3. **Client data layer, extended from M7 to every endpoint**
   - [ ] caching and daily re-checks for every static endpoint
   - [ ] polling only the live layers that are toggled on
   - [ ] pausing when the app is in the background
4. **Map layers (UC 0002–0007)**
   - [ ] nearby taxis, with clustering or density
   - [ ] hotspots
   - [ ] charging stations
   - [ ] fuel stations
   - [ ] carparks with availability
   - [ ] hawker centres
   - [ ] vehicle type hides irrelevant energy stops (FR-2.1.1)
5. **Location (UC 0013).** This comes before recommendations, which need the driver's position.
   - [ ] GPS tracking
   - [ ] driver pin
   - [ ] re-centre button
   - [ ] banner when location permission is denied
6. **Recommendations (UC 0008–0009)**
   - [ ] `RecommendationStrategy`, with Pickup and RestStop strategies (Strategy pattern)
   - [ ] `Sidemenu` and `RecommendationCard`, with results sorted by proximity
7. **Navigation and bookmarks (UC 0011–0012)**
   - [ ] Google Maps deep link
   - [ ] Yes/No prompt with "Do not show again"
   - [ ] starring and unstarring landmarks
   - [ ] the bookmark panel
8. **Settings (FR-2)**
   - [ ] EN/ZH language switch
   - [ ] vehicle type
   - [ ] the other settings agreed in the scope decision
   - [ ] every setting persisted
   - [ ] Help & Support page (from the dialog map)
9. **Hardening and deployment**
   - [ ] NFRs: toasts on every failure, timeouts, large icons with text labels
   - [ ] wider test coverage
   - [ ] HTTPS deployment on the school lab server

---

## Design decisions

### From reviewing the diagrams
- **D1 — Freshness.**
  - Static layers (taxi stands, carparks, hawker centres, fuel, charging, rest-stop sites) are re-checked daily using ETags.
  - Only live layers (taxis, hotspots, availability) follow the 5-minute rule, and they're polled only while toggled on.
  - A toggle reads from `LandmarkRepository`, which is loaded from the cache. The "Unable to load" exception only happens when there's no cached copy at all.
  - This fixes the contradiction in UC 0001 and UC 0004–0007.
- **D2 — Sync.**
  - The server syncs on its own schedule, whether or not anyone is using the app. It's the only part that calls external APIs or holds keys.
  - The client only ever refreshes from our server.
  - UC 0010 currently describes these two as one use case.
- **D3 — Notices and toggle state.**
  - `MapDisplayController` holds a `notice` that `MapView` shows as a toast, because controllers never call views.
  - `SettingsController` is the only owner of which layers are visible.
- **D4 — Async I/O.**
  - Every network and storage call returns a `Promise`.
  - `DataApiClient.get` returns either `ok` with the body or `not-modified`.
- **D5 — Types.**
  - A generic `DatasetAdapter<T>` with `prepare(raw: unknown): T`, checked with zod.
  - `ApiResponse<T>` everywhere, and no `Object` types.
  - `Bounds`, `Duration`, `DateTime`, `Json` and `Callback` get real definitions.
- **D6 — Location.**
  - `address` is optional.
  - Distances are in metres.
  - JSON DTOs are converted into entity classes in one place.
- **D7 — Server startup.**
  - The server syncs once at boot and retries failures.
  - It returns 503 only until the first successful sync.
  - If a later sync fails, it keeps the last good copy.

### From the Lab 3 AI report
- Use string unions instead of TS enums.
- `Bookmark` gets its own `id` and stores `landmarkId`, not the `Landmark` object.
- `NavigationGateway` only builds the Google Maps URL. The view opens it.
- Each server adapter declares its own data source (URL, paging, schedule).
- `LandmarkRepository` gets a getter for taxis.
- At startup the repository loads from the cache, even when the cache is still fresh.
- `UserPreferences` gets `fontSize`.
- `calculateAmenities` receives the driver's vehicle type.

---

## Decisions I'll be asked about

| When | Decision |
|---|---|
| M7 | Should `CacheManager` stay a Singleton as in the design model, which shows the pattern, or be created once and passed in, which is easier to test? |
| Package 2 | Which fuel-station data source to use (the team hasn't chosen one). What "hotspots" should mean: as far as Claude knows, LTA's crowd forecast only covers MRT platforms. |
| Package 6 | How to score pickup spots and rest stops. |
| Package 8 | Which settings are in scope. The dialog map and data dictionary mention font size, dark/light mode and a narrator, but no FR covers them. |
| Package 9 | How to get access to the school lab server, and whether it can serve HTTPS. |
| Any time | Where the code lives, e.g. a GitHub repo. The team repo is for PDFs only. |

## Things I need to do
- [ ] Register for an LTA DataMall AccountKey before M3. It's sent by email, which can take a while.
- [ ] Register for a OneMap account before Phase 2.
- [ ] Optional: a data.gov.sg API key, which raises the rate limit.

## Doc errors to raise with the team
These aren't code problems, but the team's documents contradict each other:
- The data dictionary's definitions of *Suggested Pickup* and *Suggested Rest Stop* are swapped compared with UC 0008/0009 and FR-1.3.
- UC 0001 and UC 0004–0007 contradict themselves twice:
  - The "cache under 5 minutes" precondition clashes with their own note that the data is static, and with NF-2.1.1.
  - "Markers available offline" clashes with the exception "fails to retrieve from the server".
- UC 0010 mixes the server's sync with the client's refresh, and has the client holding API credentials.
- UC 0009 has copy-paste errors: pickup probability is "based on nearby amenities", and its exceptions mention rest stops.
- The deployment diagram still says the framework and host are undecided.
- The AI report and the Lab 3 report number the use cases differently. This plan uses the Lab 3 report's numbering.
- `UserPreferences` has no font size, dark/light mode or narrator, although the data dictionary and dialog map mention them.
