import type { Provider } from "./Provider.js";

/** Which environment variable holds each provider's key. */
const ENV_VARIABLE: Record<Provider, string> = { LTA_DATAMALL: "LTA_ACCOUNT_KEY" };

export class ApiKeyStore {
  private readonly keys = new Map<Provider, string>();

  constructor(env: Record<string, string | undefined> = process.env) {
    for (const [provider, variable] of Object.entries(ENV_VARIABLE) as [Provider, string][]) {
      const value = env[variable]?.trim();
      if (value) this.keys.set(provider, value);
    }
  }

  getKey(p: Provider): string {
    const key = this.keys.get(p);
    if (!key) throw new Error(`No API key for ${p}: set ${ENV_VARIABLE[p]} in server/.env`);
    return key;
  }
}
