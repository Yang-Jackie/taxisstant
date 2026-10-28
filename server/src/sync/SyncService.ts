import type { ServerDataCache } from "../cache/ServerDataCache.js";
import type { ExternalApiFacade } from "../external/ExternalApiFacade.js";
import type { Dataset } from "../cache/Dataset.js";
import type { DatasetAdapter } from "./DatasetAdapter.js";
import type { SuggestionStrategy } from "./strategies/SuggestionStrategy.js";

export class SyncService {
  private readonly facade: Pick<ExternalApiFacade, "fetch">;
  private readonly cache: ServerDataCache;
  private readonly adapters: DatasetAdapter<unknown>[];
  private readonly retryDelayMs: number;
  private readonly strategies: readonly SuggestionStrategy<unknown>[];
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private stopped = false;

  constructor(
    facade: Pick<ExternalApiFacade, "fetch">,
    cache: ServerDataCache,
    adapters: DatasetAdapter<unknown>[],
    retryDelayMs = 60_000,
    strategies: readonly SuggestionStrategy<unknown>[] = [],
  ) {
    this.facade = facade;
    this.cache = cache;
    this.adapters = adapters;
    this.retryDelayMs = retryDelayMs;
    this.strategies = strategies;
  }

  /** Syncs every adapter once, then keeps each one refreshing on its own schedule. */
  async start(): Promise<void> {
    this.stopped = false;
    await Promise.all(this.adapters.map((a) => this.syncAndSchedule(a)));
  }

  stop(): void {
    this.stopped = true;
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
  }

  private async syncAndSchedule(a: DatasetAdapter<unknown>): Promise<void> {
    const ok = await this.sync(a);
    if (this.stopped) return;
    const delay = ok ? a.getRefreshInterval() : this.retryDelayMs;
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      void this.syncAndSchedule(a);
    }, delay);
    this.timers.add(timer);
  }

  /** One attempt: fetch → prepare → store. Returns false (and logs) instead of throwing. */
  private async sync(a: DatasetAdapter<unknown>): Promise<boolean> {
    try {
      const responses = await Promise.all(a.getPaths().map((path) => this.facade.fetch(a.getSource(), path)));
      this.cache.put(a.getDataset(), a.prepare(responses));
      this.buildSuggestions(a.getDataset());
      return true;
    } catch (err) {
      console.error(`Sync of ${a.getDataset()} failed: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }

  /**
   * The design model's buildSuggestions: rebuilds the sites of every strategy that reads the dataset that just
   * changed. A strategy that fails is logged; it doesn't fail the sync that triggered it.
   */
  private buildSuggestions(changed: Dataset, now = new Date()): void {
    for (const strategy of this.strategies) {
      if (!strategy.getInputs().includes(changed)) continue;
      try {
        const sites = strategy.buildSites(this.cache, now);
        if (sites !== undefined) this.cache.put(strategy.getDataset(), sites);
      } catch (err) {
        console.error(`Building ${strategy.getDataset()} failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
}
