import { z } from "zod";
import type { ApiKeyStore } from "./ApiKeyStore.js";
import type { Provider } from "./Provider.js";

const BASE_URL: Record<Provider, string> = {
  LTA_DATAMALL: "https://datamall2.mytransport.sg/ltaodataservice",
};

/** LTA returns at most 500 rows per request. */
const LTA_PAGE_SIZE = 500;

/** LTA's envelope around every response: { "odata.metadata": "...", "value": [ ...rows ] } */
const LtaPage = z.object({ value: z.array(z.unknown()) });

export class ExternalApiFacade {
  private readonly keys: ApiKeyStore;
  private readonly fetchFn: typeof fetch;

  constructor(keys: ApiKeyStore, fetchFn: typeof fetch = fetch) {
    this.keys = keys;
    this.fetchFn = fetchFn;
  }

  async fetch(p: Provider, path: string): Promise<unknown> {
    const headers = { AccountKey: this.keys.getKey(p), accept: "application/json" };
    const rows: unknown[] = [];

    for (let skip = 0; ; skip += LTA_PAGE_SIZE) {
      const res = await this.fetchFn(`${BASE_URL[p]}${path}?$skip=${skip}`, { headers });
      if (!res.ok) throw new Error(`${p} ${path} answered ${res.status} ${res.statusText}`);

      const page = LtaPage.parse(await res.json()).value;
      rows.push(...page);
      if (page.length < LTA_PAGE_SIZE) return rows;
    }
  }
}
