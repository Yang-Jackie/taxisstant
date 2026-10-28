import { parse as parseCsv } from "csv-parse/sync";
import { z } from "zod";
import type { ApiKeyStore } from "./ApiKeyStore.js";
import type { Provider } from "./Provider.js";

const LTA_BASE_URL = "https://datamall2.mytransport.sg/ltaodataservice";
const DATA_GOV_SG_BASE_URL = "https://api-open.data.gov.sg/v1/public/api/datasets";
/** data.gov.sg's real-time APIs (taxi availability, …), which answer with JSON directly. */
const DATA_GOV_SG_REAL_TIME_URL = "https://api.data.gov.sg";
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

/** OpenStreetMap's usage policy asks every client to identify itself. */
const USER_AGENT = "taxisstant/1.0 (SC2006 student project; https://github.com/Yang-Jackie/taxisstant)";

/** LTA returns at most 500 rows per request. */
const LTA_PAGE_SIZE = 500;

/** LTA's envelope around every response: { "odata.metadata": "...", "value": [ ...rows ] } */
const LtaPage = z.object({ value: z.array(z.unknown()) });

/** LTA's file datasets (e.g. EVCBatch) answer with a single row holding a download link instead of the data. */
const LtaDownloadLink = z.tuple([z.object({ Link: z.url() })]);

/** data.gov.sg's answer to poll-download: a short-lived link to the dataset's file. */
const DataGovSgDownload = z.object({ code: z.literal(0), data: z.object({ url: z.url() }) });

/** Overpass answers 200 even when a query fails part-way; the only sign is an error "remark" next to partial data. */
const OverpassResult = z.object({ elements: z.array(z.unknown()), remark: z.string().optional() });

/** The only class that talks to outside APIs: one small client per provider, each returning plain JSON. */
export class ExternalApiFacade {
  private readonly keys: ApiKeyStore;
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;

  constructor(keys: ApiKeyStore, fetchFn: typeof fetch = fetch, timeoutMs = 60_000) {
    this.keys = keys;
    this.fetchFn = fetchFn;
    this.timeoutMs = timeoutMs;
  }

  /**
   * What `path` means depends on the provider: an LTA resource ("/TaxiStands"); for data.gov.sg, a dataset id
   * ("d_…") or a real-time API ("/v1/transport/taxi-availability"); or an Overpass query.
   * Resolves to the provider's data as JSON; rejects on any failure.
   */
  async fetch(p: Provider, path: string): Promise<unknown> {
    switch (p) {
      case "LTA_DATAMALL":
        return this.fetchLta(path);
      case "DATA_GOV_SG":
        return this.fetchDataGovSg(path);
      case "OSM_OVERPASS":
        return this.fetchOverpass(path);
    }
  }

  /**
   * Every page of an LTA resource, joined; or, for a file dataset, the file the link points to.
   * The pages of a live feed don't always come from one snapshot (seen on 28 Oct: rows shifted between pages for a
   * few minutes), so adapters with keys check for rows that came twice (CarparkAdapter).
   */
  private async fetchLta(path: string): Promise<unknown> {
    const headers = { AccountKey: this.keys.getKey("LTA_DATAMALL"), accept: "application/json" };
    const separator = path.includes("?") ? "&" : "?"; // some resources take their own parameters (?TrainLine=…)
    const rows: unknown[] = [];
    for (let skip = 0; ; skip += LTA_PAGE_SIZE) {
      const res = await this.request(`${LTA_BASE_URL}${path}${separator}$skip=${skip}`, { headers });
      const page = LtaPage.parse(await res.json()).value;
      rows.push(...page);
      if (page.length < LTA_PAGE_SIZE) break;
    }
    const link = LtaDownloadLink.safeParse(rows);
    if (!link.success) return rows;
    return (await this.request(link.data[0].Link)).json(); // a signed link: it needs no key
  }

  /**
   * data.gov.sg's real-time APIs answer directly. Its datasets come as files: ask for a link, then download it
   * (CSV becomes an array of rows).
   */
  private async fetchDataGovSg(path: string): Promise<unknown> {
    if (path.startsWith("/")) return (await this.request(`${DATA_GOV_SG_REAL_TIME_URL}${path}`)).json();
    const datasetId = path;
    const poll = await this.request(`${DATA_GOV_SG_BASE_URL}/${encodeURIComponent(datasetId)}/poll-download`);
    const { url } = DataGovSgDownload.parse(await poll.json()).data;
    const file = await this.request(url);
    const text = await file.text();
    const isCsv = (file.headers.get("content-type") ?? "").includes("csv") || new URL(url).pathname.endsWith(".csv");
    return isCsv ? parseCsv(text, { columns: true, skip_empty_lines: true, bom: true }) : JSON.parse(text);
  }

  private async fetchOverpass(query: string): Promise<unknown> {
    const res = await this.request(OVERPASS_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": USER_AGENT },
      body: new URLSearchParams({ data: query }),
    });
    const result = OverpassResult.parse(await res.json());
    if (result.remark && /error/i.test(result.remark)) throw new Error(`Overpass query failed: ${result.remark}`);
    return result;
  }

  /** One HTTP call with a timeout. Errors name the host and path only: query strings may hold signatures. */
  private async request(url: string, init: RequestInit = {}): Promise<Response> {
    const { host, pathname } = new URL(url);
    let res: Response;
    try {
      res = await this.fetchFn(url, { ...init, signal: AbortSignal.timeout(this.timeoutMs) });
    } catch (err) {
      throw new Error(`${host}${pathname} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (!res.ok) throw new Error(`${host}${pathname} answered ${res.status} ${res.statusText}`.trim());
    return res;
  }
}
