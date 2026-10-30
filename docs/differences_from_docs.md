# TaxiMate: where the app differs from our documents

For whoever updates the report and the diagrams. This lists every place where the app, as built on 30 Oct 2026, differs from our documents. It also lists the mistakes we found inside the documents themselves.

Checked against:
- the 23 Oct diagrams: `Lab3_DesignModel.drawio` (class diagram) and `Lab3_SystemArchitecture.drawio` (layered and deployment diagrams);
- the Lab 3 report: use cases UC 0001–0013, FR/NFR, the data dictionary;
- the dialog map and the mockup;
- the "Changes needed (29/10)" list in our Lab Report Google Doc.

The D-numbers point to the decisions in [PLAN.md](../PLAN.md#design-decisions), where each reason is written out in full. The APIs, storage and data formats are in [report_materials.md](report_materials.md).

> **Update from the `.drawio` files, not the PNGs.** The PNGs in the team repo's `lab3/Diagrams/` (15 Oct) are older than the 23 Oct `.drawio` files. They still show `LandmarkRepository`, `CrowdForecast`, `RestStopSite` and suggestions calculated on the phone.

## The big ones

Each of these touches several documents:

1. **Hotspots are real-time crowd levels, not a forecast.** They come from LTA's platform crowd density, refreshed every 10 minutes (not a forecast every 30). Only busy stations (medium or high) are drawn. This affects FR-1.2.3, NF-2.1.2, the data dictionary's "Crowd forecast", UC 0003 and the deployment diagram. (D20, D23)
2. **The server scores the suggestions; the phone only ranks them by distance.** The 23 Oct diagrams already say so, but UC 0008/0009 and FR-1.3 still have the phone calculating them. (D28, D29, D34)
3. **Petrol stations come from OpenStreetMap,** a third data provider that no document shows. No government dataset lists petrol stations. (D12)
4. **The server never calls OneMap.** The map tiles need no token, and the station positions are built once into a file. Remove the OneMap search API and the "OneMap token refresh". (D14)
5. **No data.gov.sg "HDB carpark availability".** LTA's feed already covers HDB, URA and LTA carparks. (D19)
6. **Suggestions live in the side menu:** a toggle each, and under it a list of the best 3 nearby. (D33)
7. **Bookmarks** have a section in the side menu, and there's a new **Bookmarks filter**, red and first in the Filter bar. Its design-model changes are in section 1. (D40, D53)
8. **Tapping a map icon opens the place's details,** with a star (bookmark) and Navigate. It doesn't go straight to the Google Maps prompt. (D39)
9. **The Google Maps link has the destination only,** never the driver's position. (D41)
10. **There is no `TaxiDriver`.** With no accounts there's no driver id, and the phone keeps only the last position. (D32)

## 1. Design model (`Lab3_DesignModel.drawio`)

### Domain objects (entity and container classes)

| Class | Change | Why |
| --- | --- | --- |
| `Location` | `address: String` becomes optional `[0..1]` | Taxis, hotspots and suggested sites have no address (D6) |
| `Landmark` | `id`, `name` and `location` are public and read-only (`+`), not `#` | Other layers show them; the map shows `name` (D8) |
| `Carpark` | Remove `totalLots`. `availableLots` becomes `[0..1]`. Add `area: String [0..1]` and `availabilityAsOf: DateTime [0..1]` | LTA gives free lots only (D19). The popup says "as of 20:50" |
| `FuelStation` | `brand` becomes `[0..1]`. Add `openingHours: String [0..1]` | OpenStreetMap doesn't have them for every station (D12) |
| `ChargingStation` | `operator: String` becomes `operators: List<String>`. Add `maxPowerKw: double [0..1]`, `hasDcFast: Boolean` and `plugTypes: List<String>`. `availablePoints` becomes `[0..1]`, plus `availabilityAsOf: DateTime [0..1]` | 42 places have several operators. An EV taxi mid-shift needs DC fast charging (D15) |
| `HawkerCentre` | `operatingHours: String` becomes `closures: List<Closure>`, where a `Closure` has `from`, `to` and `reason` (cleaning or works). Add `foodStalls: int` and `marketStalls: int`. `isOpen(t)` means "not closed for cleaning or works that day" | Centres have no opening hours (stalls do); NEA publishes closure dates (D13) |
| `Taxi` | Add `seenAt: DateTime` | Taxis older than 5 minutes aren't shown (D22) |
| `Hotspot` | Add `codes: List<String>` (station codes, e.g. `NS10`) | |
| `SuggestedSite` | Add `name: String` and `getKind(): RecommendationKind` | Cards and pins show the site's name |
| `SuggestedPickup` | `crowdDensity` becomes `[0..1]`. Add `stationName: String [0..1]` | A stand with no station within 500 m has neither (D28) |
| `SuggestedRestStop` | Add `foodStalls: int`, `hasParking: Boolean`, `freeLots: int [0..1]` and `freeChargePoints: int [0..1]` | What the card's summary shows (D29) |
| `UserPreferences` | Add `showBookmarks: Boolean` and `suggestionLayers: Map<RecommendationKind, Set<LayerType>>`. `vehicleType` becomes `[0..1]`. `fontSize` is one of 100, 115, 130 or 150 (% of the phone's size) | The Bookmarks filter (D53). Turning a suggestion off undoes only the layers it turned on (D35). Both energy layers show until a vehicle type is chosen (D43). Font sizes (D52) |
| `Bookmark` | Add `id: String`, `layer: LayerType`, `landmarkId: String` and `location: Location`. A bookmark records its landmark's id, instead of pointing at the `Landmark` | `BookmarkList.remove(id)` needs an id, and the list must read offline (D42) |
| `BookmarkList` | Add `get(id)` and `has(id)` | |
| `TaxiDriver` | Remove. The driver's position is part of `LocationController`'s state, as a `DriverPosition` (location, accuracy, time, and whether it's live) | No accounts, so no `driverId` (D32) |
| `MapDataRepository` | `updateAvailability(t, values)` gets a third parameter, `asOf: DateTime` | Popups say how old the figures are |
| `LayerType` | No change. **Bookmarks are not an eighth layer** | Layers are the server's datasets; bookmarks live on the phone (D53) |
| Types note | Add `Viewport`: a `Bounds` plus the zoom | Clustering depends on the zoom (D17) |

`TaxiStand` and `Site` are unchanged.

### Controllers (application logic layer)

| Class | Change | Why |
| --- | --- | --- |
| `DataSyncObserver` | Add `onRecommendationUpdated(k: RecommendationKind)`. Both methods are optional | New suggestion scores are a different event from new layer data (D9) |
| `DataSyncController` | Add `refreshLayer(t)` (one static layer, for a toggle), `refreshLiveLayer(t)` and `refreshSuggestions(k)`. Remove `refreshTimes`: the `CacheManager` records when each copy was saved | Every static layer is downloaded at startup (D18) |
| `MapDisplayController` | `refreshVisible(bounds)` becomes `refreshVisible(viewport)`. Add `highlight(l: Landmark)` (an opened bookmark), `centreOnDriver()`, `showNotice(n)` and `dismissNotice()`. Its state adds `notice`, `highlighted` and `loading` | Clustering needs the zoom (D17). Toasts are controller state, because controllers never call views (D3) |
| `LocationObserver` | `onLocationUpdated(loc: Location)` becomes `onLocationUpdated(p: DriverPosition)` | The blue dot needs the accuracy, and whether the position is live |
| `LocationController` | Add `retry()` (after location was denied) and `setForeground(on)` (GPS pauses while the app is in the background). `getCurrentLocation()` returns `Location [0..1]` | D30, D32 |
| `RecommendationController` | Remove `onDataUpdated(t)`. It implements `onRecommendationUpdated(k)` instead, and `LocationObserver` too, to re-rank as the driver moves | The server scores the sites, so the phone listens for new scores, not new layers (D9) |
| `SettingsController` | Add `setBookmarksShown(on: Boolean)` | The Bookmarks filter (D53) |
| `BookmarkController` | Add `toggleShown()` (the Bookmarks filter) and `isBookmarked(l)`. It implements `DataSyncObserver` | Bookmarked markers follow new data (D53) |
| `NavigationController` | `navigateTo(dest)` also takes the place's name, for the prompt | |
| **new:** `LayerClusters` | Merges nearby markers into one bubble with a count while zoomed out (the Supercluster library) | 5,000 markers are slow and unreadable (D17, D24) |

### Presentation layer (boundary classes)

| Class | Change | Why |
| --- | --- | --- |
| `MapView` | `onPan(bounds)` becomes `onPan(viewport)`. Remove `onConfirmNav` | D17. The prompt is its own component (D39) |
| `FilterTool` | Add `onToggleBookmarks()`. The Bookmarks chip comes first | D53 |
| **new:** `LandmarkDetails` | A map icon's details popup, with the star and Navigate | D39 |
| **new:** `NavigationPrompt` | "Open Google Maps?" Yes / No, with "Do not show this again" | D39 |
| **new:** `HelpView` | The Help & Support page | D46 |
| **new:** `LanguageView`, `LanguageButton` | The Language page (from the side menu), and the one-tap button at the top right | D47 |
| **new:** `LocationBanner`, `LocationButton` | The "location denied" banner, and the crosshair button that re-centres on the driver | D30, D31 |
| **new:** `Toast` | Shows the controllers' notices | D3 |

Smaller helpers (`Drawer`, `MenuButton`, `LanguageChoice`) don't need to be drawn.

### Data access and device services

| Class | Change | Why |
| --- | --- | --- |
| `CacheManager` | **Not a «singleton»:** remove `instance` and `getInstance()`. `initControllers()` creates one and passes it to `DataSyncController` | There's still only one, but tests can use a fresh one and the dependency shows in the constructor (D10) |
| `DataApiClient` | `get(endpoint, etag)` returns either "ok" with the response, or "not modified" | D4 |
| `GPSInterface` | `watchPosition(onFix, onProblem)`, which returns a way to stop watching | "Denied" and "unavailable" are told apart (D30) |
| `NavigationGateway` | `openDeepLink(origin, dest)` becomes `openDeepLink(dest)` | D41 |
| All of them | Every network and storage call returns a `Promise` | The diagram does this for `LocalStore` only (D4) |

### Server

| Class | Change | Why |
| --- | --- | --- |
| `DatasetAdapter` | `getPath(): String` becomes `getPaths(): List<String>`, and `prepare()` gets one answer per path | LTA's crowd API takes one train line per request (D21) |
| `ApiKeyStore` | Remove `oneMapToken` and `refreshOneMapToken()` | The server never calls OneMap (D14) |
| `Provider` | LTA DataMall, data.gov.sg and **OpenStreetMap (Overpass)**. Not OneMap | D12, D14 |
| `SuggestionStrategy` | Add `getDataset()` and `getInputs()`. `buildSites(cache, now)` | A strategy rebuilds its sites whenever one of its inputs syncs |
| `SyncService` | Add `stop()`. `buildSuggestions()` runs after an input syncs, not on a timer of its own | |
| `ExternalApiFacade` | Retries a provider's server error after 1 s, then 3 s | D26 |

`DataApiController`'s 11 `get…` methods are one route table in the code. The diagram can keep the 11 methods.

### The notes on the diagram

- **«contract» API (OpenAPI):** "TypeScript types generated from the server's OpenAPI spec" is the other way round. Zod schemas in `shared/` give both sides their types, and the OpenAPI file is generated from those schemas. (D11)
- **Design decisions, Patterns:** remove Singleton (`CacheManager`, D10). Optionally, under Observer, add `Store`: the base class of every controller's state, which React subscribes to.
- **Design decisions, Start-up:** `initControllers()` creates everything, then `startControllers()` loads the settings and bookmarks, starts the GPS, calls `loadCached()`, and then `refreshStatic()` in the background (D18).
- **Types used above, Provider:** "(data.gov.sg, LTA DataMall, OneMap)" becomes "(LTA DataMall, data.gov.sg, OpenStreetMap)".

## 2. Layered and deployment diagrams (`Lab3_SystemArchitecture.drawio`)

| Box | The diagram says | Change it to |
| --- | --- | --- |
| «artifact» Web app | "framework not decided (e.g. Next.js / React)" | React 19 with Vite, TypeScript (single-page app) |
| «component» Map library | "Leaflet (proposed)" | Leaflet 1.9, through react-leaflet |
| «execution environment» Backend runtime | "framework not decided" | Node.js 24, Express 5, TypeScript |
| «node» Application server | "cloud host not decided" | Still not decided: we've asked the school. Leave it |
| ExternalApiFacade + ApiKeyStore | "OneMap token refresh" | Remove it (D14) |
| data.gov.sg | "taxi availability, HDB carpark availability; datasets: hawker centres" | Taxi availability; hawker centres and their closure dates (NEA). Remove HDB carpark availability (D19) |
| LTA DataMall | "… station crowd forecast" | "… platform crowd density (real time)" (D20) |
| OneMap search / geocoding API (token) | | Remove it from the running system. A developer script used OneMap search once, to build the station file (D14) |
| Basemap tiles | "e.g. OneMap or OpenStreetMap tiles" | OneMap tiles (Default, or Night in dark mode), no key |
| *(missing)* | | Add «external system» **OpenStreetMap Overpass API**: petrol stations, daily, no key (D12) |
| «storage» Browser storage | "prepared static data, last live data, preferences, bookmarks" | Add "last position" (D32) |
| Notes, server | "availability and suggested sites 1–5 min, hotspots 30 min" | Carpark availability every minute, chargers every 5 minutes, hotspots every 10. Suggested sites are rebuilt whenever their inputs change: pickups as often as the taxis, every 30 s (D20) |
| Notes, client | "polls only toggled live layers together" | Add: every 30 seconds (D25) |

The layered diagram's row of external systems and its `ApiKeyStore` box ("OneMap token") need the same changes. Its client boxes need the class changes from section 1, such as removing `TaxiDriver`.

## 3. Use cases (Lab 3 report)

| Use case | The document says | The app does |
| --- | --- | --- |
| UC 0001, 0004–0007 (Taxi stands, Charge, Fuel, Carpark, Hawker food) | Precondition: the cache is under 5 minutes old. Exception: the server can't be reached | These layers are static. All of them are downloaded at startup and re-checked daily, so they work offline. "Unable to load" shows only when nothing was ever saved (D1, D18) |
| UC 0002 Toggling NearbyTaxis | "Nearby taxis" | The layer is called "Taxis" (德士) (D52). Taxis older than 5 minutes aren't shown (D22). Zoomed out, they merge into bubbles with a count (D24) |
| UC 0003 Toggling Hotspots | A crowd forecast | Real-time crowd levels per MRT or LRT station, every 10 minutes. Only medium and high are drawn, as heat circles. A level shows until 30 minutes after its 10-minute slot (D20, D22, D23) |
| UC 0008 SuggestedRestStop, UC 0009 SuggestedPickup | The phone calculates the suggestions. Turning one off turns off all its related layers (UC 0008's alternative flow) | The server scores the sites. The phone keeps those within 3 km (pickup) or 5 km (rest stop), ranks them by score and distance, and lists the best 3 in the side menu (D33, D34). Off turns off only the layers it turned on (D35). Pickups count for 5 minutes, rest stops for 15 (D36) |
| UC 0010 SyncExternalData | One flow for both the server's sync and the phone's refresh. The phone holds API credentials | Two separate jobs. The server fetches on its own schedule and holds the only key; the phone talks only to our server (D2) |
| UC 0011 Bookmarks | A "bookmark menu", not placed anywhere | In the side menu, under Smart suggestions, newest first, with distances (D40). The star in a place's details saves it (D39). New: the Bookmarks filter shows every bookmark on the map (D53) |
| UC 0012 NavigateTo | Step 4 sends both positions | The destination only: Google Maps finds the phone's position itself. It shows the route, and the driver starts it (D41) |
| UC 0013 UpdateLocation | When denied, a banner takes the driver to the OS app settings. Step 3 keeps the map on the driver | A web page can't open settings, so the banner shows the steps for this phone's browser, plus Try again (D30). The map centres on the driver once; after that, the crosshair button lights up when the driver is off-centre (D31). Only the last position is stored, on the phone (D32) |

## 4. Requirements (FR and NFR)

| Requirement | The document says | The app does |
| --- | --- | --- |
| FR-1.2.3, NF-2.1.2 | Crowd forecasts | Real-time crowd levels (D20) |
| FR-1.3 | The phone calculates the suggestions; no formula is given | The server scores them, with the formulas in D28 (pickup) and D29 (rest stop) |
| FR-1.3.1 | High taxi density counts in favour of a pickup spot | The taxi data counts **empty** taxis, which are competition. More empty taxis nearby lowers the score (D28) |

## 5. Data dictionary (Lab 3 report)

- **Suggested Pickup and Suggested Rest Stop have each other's definitions:** swap them.
- **"Crowd forecast"** becomes something like "Crowd level: how crowded an MRT or LRT station's platforms are right now (LTA)" (D20).
- **Sidemenu:** add Bookmarks to its list (Smart Recommendations, **Bookmarks**, Language Options, App Settings, Help & Support) (D40).
- **App Settings:** also has the language, and "Ask before opening Google Maps" (D39, D47).
- **Vehicle Type:** the app says "Petrol or diesel" and "Electric" (not only diesel cabs).
- **Toggles:** add red for the Bookmarks filter. Amber icons and outlines are a darker amber on light backgrounds, so they're easier to read (D50, D53).

## 6. Dialog map

- **Suggestions:** a list screen in the dialog map. In the app, each suggestion has a toggle in the side menu with a list of the best 3 under it; tapping one shows it on the map (D33).
- **Tapping a map icon** opens the place's details (star, Navigate), not the Google Maps prompt. Navigate then asks (D39).
- **Bookmarks:** there's no bookmarks screen. They're a section of the side menu (D40), plus the Bookmarks filter in the Filter bar (D53).
- **Settings:** no "narrator on/off": the phone's own screen reader (VoiceOver, TalkBack) does that job, and every control has a label (D45).
- **Help & Support:** no "contact information", because none is given anywhere. It has how to use each feature, the data sources and their licences (D46).
- **Language:** also a one-tap button at the top right of the map (D47).
- **New screen state:** the "location denied" banner (D30).

## 7. Mockup (and our 29 Oct change list)

- **Words:** "Nearby taxis" is "Taxis". "Text size" is "Font size", with Normal, Large, Extra large and Largest. The change list asked for Small, Normal, Large and Larger, but the sizes are the same (D52).
- **Icons:** Bookmarks is a star; Smart suggestions, sparkles; Suggested pickup, a person hailing a taxi; Suggested rest stop, a cup; Taxi stand, a stop sign beside a car. Hotspot keeps the flame (D52).
- **Colours:** Bookmarks are red. Amber icons are darker on light backgrounds (D50). There's a dark mode (D44).
- **Filter bar order:** Bookmarks first, then the layers in the mockup's order (D53).

## 8. Mistakes inside the documents

These are about the documents, not the app. They disagree with each other or with themselves.

- **The data dictionary swaps** the definitions of Suggested Pickup and Suggested Rest Stop.
- **UC 0009 has copy-paste errors.** Pickup probability is "based on nearby amenities", its exceptions mention rest stops, and its 2a toast says "rest stop markers".
- **UC 0001 and 0004–0007 contradict themselves:**
  - "cache under 5 minutes" against their own note that the data is static;
  - "markers available offline" against the exception "fails to retrieve from the server".
- **UC 0008 and 0009 contradict themselves** in the same way: "not older than 5 minutes" against "markers available offline".
- **UC 0012** needs the current position in step 4, calls it optional in its postcondition, and fails without it in its exception.
- **UC 0010** mixes up the server's scheduled sync and the phone's refresh, and gives the phone the API credentials.
- **FR-1.3.1** counts taxi density in favour of a pickup, but the taxi data is empty taxis. No document gives a formula for `calculateProbability` or `calculateAmenities`.
- **The design model** has no source for fuel stations, and no data exists for `HawkerCentre.operatingHours`.
- **The dialog map and the use cases disagree:** suggestions are a list screen in one and map toggles in the other; tapping an icon goes to the navigation prompt in one and to the place's details in the other.
- **The AI report and the Lab 3 report number the use cases differently.** This file uses the Lab 3 report's numbers.
- **The app's name:** the mockup says "TaxiMate", the first page title "Taxi Assistant". It's TaxiMate.
- **The repo's diagram PNGs (15 Oct)** don't match the 23 Oct `.drawio` files.

## 9. Not built yet: don't describe these as done

- **Deployment:** there's no server yet, so no public HTTPS address. For now the app runs on `http://localhost`.
- **Installing the app on the home screen and opening it with no signal** (a service worker, D48): planned for deployment. Today the saved data works offline, but the page itself has to load from the server.
- **The Chinese** hasn't been checked by a native speaker yet.
