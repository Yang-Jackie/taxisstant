import type { Provider } from "./Provider.js";

/** Which environment variable holds each provider's key. Providers not listed here need no key. */
const ENV_VARIABLE: Partial<Record<Provider, string>> = { LTA_DATAMALL: "LTA_ACCOUNT_KEY" };

export class ApiKeyStore {
  private readonly keys = new Map<Provider, string>();

  constructor(env: Record<string, string | undefined> = process.env) {
    for (const [provider, variable] of Object.entries(ENV_VARIABLE) as [Provider, string][]) {
      const value = env[variable]?.trim();
      if (value) this.keys.set(provider, value);
    }
  }

  getKey(p: Provider): string {
    const variable = ENV_VARIABLE[p];
    if (!variable) throw new Error(`${p} doesn't use an API key`);
    const key = this.keys.get(p);
    if (!key) throw new Error(`No API key for ${p}: set ${variable} in server/.env`);
    return key;
  }
}
