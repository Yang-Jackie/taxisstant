# TaxiMate

A mobile web app for Singapore taxi drivers, made for SC2006 Software Engineering. Its map shows:

- taxi stands
- empty taxis nearby
- crowded MRT and LRT stations
- carparks with their free lots
- fuel stations and EV chargers
- hawker centres

It suggests where to find a fare and where to take a break, hands directions to Google Maps, keeps bookmarks, and works in English and Chinese.

## How it fits together

| Folder    | What it is                                                                                                                                                                                                                                                                                         |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `client/` | The app in the browser: React with Vite, and Leaflet with OneMap's map. It keeps a copy of the data on the phone (IndexedDB), so it still works without a connection. The driver's location never leaves the phone.                                                                               |
| `server/` | The data service: Node.js with Express. On a schedule, it fetches open data from LTA DataMall, data.gov.sg and OpenStreetMap, checks and prepares it, and scores the suggested sites. It serves all of this at `/api`. There's no database: it keeps the latest good copy of each dataset in memory. |
| `shared/` | The contract between the two: zod schemas for every API response, and `shared/openapi.json`, generated from them.                                                                                                                                                                                  |

[PLAN.md](PLAN.md) has the build plan and the design decisions (D1–D48). It also maps the code to the team's design model.

## Set up

1. Install Node.js 24, for example with [fnm](https://github.com/Schniz/fnm) or nvm. npm comes with it.
2. Get an LTA DataMall API key (an "AccountKey") at [datamall.lta.gov.sg](https://datamall.lta.gov.sg/content/datamall/en/request-for-api.html). It arrives by email, which can take a while.
3. In the repository's root, run `npm install`. This installs all three folders.
4. Run `cp server/.env.example server/.env`, then put your key after `LTA_ACCOUNT_KEY=` in `server/.env`. Git ignores that file, so the key stays on your computer. Never commit it.

## Run

```sh
npm run dev
```

This starts the data service on port 3000 and the app on port 5173. The app passes requests for `/api` on to the service. Open <http://localhost:5173>.

- **The first data takes about a minute.** The service fetches everything when it starts, and answers 503 for a dataset until it has loaded.
- **Location:** browsers only share location with secure pages, and `localhost` counts as one. To try another place without moving, open Chrome's developer tools, then More tools → Sensors → Location.
- **Phones on the same Wi-Fi** can open the app at your computer's network address, but get no location, because that address isn't a secure page. Deployment (HTTPS) is still to come.

## Check

```sh
npm run check
```

This type-checks, lints (Oxlint), checks formatting (Prettier) and runs every test (Vitest) in all three folders. Other scripts:

| Script                          | What it does                                                                     |
| ------------------------------- | -------------------------------------------------------------------------------- |
| `npm run format`                | Formats every file with Prettier                                                 |
| `npm test -w client`            | Runs one folder's tests (`-w server`, `-w shared` for the others)                |
| `npm run coverage`              | Shows how much of the code the tests run (reports in each folder's `coverage/`); it fails below the floors set in the folders' Vitest configs |
| `npm run openapi -w shared`     | Writes `shared/openapi.json` again, after a change to the contract               |
| `npm run record-samples -w server` | Records new samples of the real data, which the server's contract tests use   |
| `npm run build-stations -w server` | Rebuilds the train station file (`server/src/reference-data`) when a station opens |

## Data and credits

The data comes from LTA DataMall and data.gov.sg (Singapore Open Data Licence), OpenStreetMap contributors (Open Database Licence) and OneMap (Singapore Land Authority). The app's Help & support page gives the full statements. TaxiMate is a student project. It is not an official app, and no government agency endorses it.
