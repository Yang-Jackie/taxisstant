import { ENDPOINTS, type Endpoint } from "@taxisstant/shared";
import { STATIC_LAYERS, type StaticLayer } from "../entity/LayerType";
import type { LayerItems, MapDataRepository } from "../entity/MapDataRepository";
import type { CacheManager } from "../services/CacheManager";
import type { ApiResult, DataApiClient } from "../services/DataApiClient";
import { toCarpark } from "../services/toCarpark";
import { toChargingStation } from "../services/toChargingStation";
import { toFuelStation } from "../services/toFuelStation";
import { toHawkerCentre } from "../services/toHawkerCentre";
import { toTaxiStand } from "../services/toTaxiStand";
import type { DataSyncObserver } from "./DataSyncObserver";

/** Static layers are re-checked with the server once a day (D1). */
const STATIC_TTL_MS = 24 * 60 * 60 * 1000;

/** How one static layer gets from the cache or the server into the repository. */
interface LayerSync {
  loadCached(): Promise<void>;
  refresh(): Promise<void>;
}

export class DataSyncController {
  private readonly api: DataApiClient;
  private readonly repo: MapDataRepository;
  private readonly cache: CacheManager;
  private readonly observers: DataSyncObserver[] = [];
  private readonly layers: Readonly<Record<StaticLayer, LayerSync>>;
  private readonly refreshes = new Map<StaticLayer, Promise<void>>();

  constructor(api: DataApiClient, repo: MapDataRepository, cache: CacheManager) {
    this.api = api;
    this.repo = repo;
    this.cache = cache;
    this.layers = {
      TAXI_STAND: this.staticLayer("TAXI_STAND", ENDPOINTS.taxiStands, toTaxiStand),
      CARPARK: this.staticLayer("CARPARK", ENDPOINTS.carparks, toCarpark),
      FUEL: this.staticLayer("FUEL", ENDPOINTS.fuelStations, toFuelStation),
      CHARGING: this.staticLayer("CHARGING", ENDPOINTS.chargingStations, toChargingStation),
      HAWKER: this.staticLayer("HAWKER", ENDPOINTS.hawkerCentres, toHawkerCentre),
    } satisfies Record<StaticLayer, LayerSync>;
  }

  attach(o: DataSyncObserver): void {
    this.observers.push(o);
  }

  /** At startup: fill the repository with what earlier sessions saved, for every static layer. Never touches the network. */
  async loadCached(): Promise<void> {
    await Promise.all(STATIC_LAYERS.map((t) => this.layers[t].loadCached()));
  }

  /**
   * Brings every static layer up to date, in the background at startup (D18), so each one also works offline later.
   * Never rejects: a layer that can't load now is tried again when it is toggled on.
   */
  async refreshStatic(): Promise<void> {
    await Promise.allSettled(STATIC_LAYERS.map((t) => this.refreshLayer(t)));
  }

  /**
   * Brings one static layer up to date, once per session; calls made meanwhile share the same work.
   * Rejects only when there is nothing to show: no saved copy, and no download (UC 0001/0004–0007 exception 4a).
   */
  refreshLayer(t: StaticLayer): Promise<void> {
    let refresh = this.refreshes.get(t);
    if (!refresh) {
      refresh = this.layers[t].refresh().catch((err: unknown) => {
        this.refreshes.delete(t); // forget the failure, so the next call tries again
        throw err;
      });
      this.refreshes.set(t, refresh);
    }
    return refresh;
  }

  /** Ties one layer's endpoint, DTO-to-entity converter (D6) and repository slot together; the types must agree. */
  private staticLayer<K extends StaticLayer, D>(
    layer: K,
    endpoint: Endpoint<D[]>,
    toEntity: (dto: D) => LayerItems[K],
  ): LayerSync {
    const show = (data: readonly D[]) => {
      this.repo.replaceLayer(layer, data.map(toEntity));
      for (const o of this.observers) o.onDataUpdated(layer);
    };

    return {
      loadCached: async () => {
        const cached = await this.cache.get(endpoint.path, endpoint.response);
        if (cached) show(cached.data);
      },

      refresh: async () => {
        const cached = await this.cache.get(endpoint.path, endpoint.response);
        if (cached && !(await this.cache.isStale(endpoint.path, STATIC_TTL_MS))) return;

        let result: ApiResult<D[]>;
        try {
          result = await this.api.get(endpoint, cached?.etag);
        } catch (err) {
          if (cached) return; // offline or server down: the saved copy is still on the map
          throw err; // nothing saved and nothing downloaded: exception 4a
        }

        if (result.status === "ok") {
          await this.cache.put(endpoint.path, result.response);
          show(result.response.data);
        } else if (cached) {
          await this.cache.put(endpoint.path, cached); // 304: same data, but saving it again records today's check
        }
      },
    };
  }
}
