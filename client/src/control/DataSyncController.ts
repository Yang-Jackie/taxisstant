import type { TaxiStandDto } from "@taxisstant/shared";
import type { MapDataRepository } from "../entity/MapDataRepository";
import type { CacheManager } from "../services/CacheManager";
import type { ApiResult, DataApiClient } from "../services/DataApiClient";
import { toTaxiStand } from "../services/toTaxiStand";
import type { DataSyncObserver } from "./DataSyncObserver";

const TAXI_STANDS = "/taxi-stands";
/** Static layers are re-checked with the server once a day (D1). */
const STATIC_TTL_MS = 24 * 60 * 60 * 1000;

export class DataSyncController {
  private readonly api: DataApiClient;
  private readonly repo: MapDataRepository;
  private readonly cache: CacheManager;
  private readonly observers: DataSyncObserver[] = [];
  private taxiStandsRefresh: Promise<void> | null = null;

  constructor(api: DataApiClient, repo: MapDataRepository, cache: CacheManager) {
    this.api = api;
    this.repo = repo;
    this.cache = cache;
  }

  attach(o: DataSyncObserver): void {
    this.observers.push(o);
  }

  /** At startup: fill the repository with what an earlier session saved. Never touches the network. */
  async loadCached(): Promise<void> {
    const cached = await this.cache.get<TaxiStandDto[]>(TAXI_STANDS);
    if (cached) this.showTaxiStands(cached.data);
  }

  /** Makes sure the static layers are up to date, once per session. Calls made meanwhile share the same work. */
  refreshStatic(): Promise<void> {
    this.taxiStandsRefresh ??= this.refreshTaxiStands().catch((err: unknown) => {
      this.taxiStandsRefresh = null;
      throw err;
    });
    return this.taxiStandsRefresh;
  }

  private async refreshTaxiStands(): Promise<void> {
    const cached = await this.cache.get<TaxiStandDto[]>(TAXI_STANDS);
    if (cached && !(await this.cache.isStale(TAXI_STANDS, STATIC_TTL_MS))) return;

    let result: ApiResult<TaxiStandDto[]>;
    try {
      result = await this.api.get<TaxiStandDto[]>(TAXI_STANDS, cached?.etag);
    } catch (err) {
      if (cached) return; // offline or server down: the saved copy is still on the map
      throw err; // nothing saved and nothing downloaded: UC 0001 exception 4a
    }

    if (result.status === "ok") {
      await this.cache.put(TAXI_STANDS, result.response);
      this.showTaxiStands(result.response.data);
    } else if (cached) {
      await this.cache.put(TAXI_STANDS, cached); // 304: same data, but saving it again records today's check
    }
  }

  private showTaxiStands(data: readonly TaxiStandDto[]): void {
    this.repo.replaceLayer("TAXI_STAND", data.map(toTaxiStand));
    for (const o of this.observers) o.onDataUpdated("TAXI_STAND");
  }
}
