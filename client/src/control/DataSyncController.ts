import { ENDPOINTS, type ApiResponse, type Endpoint, type HotspotDto } from "@taxisstant/shared";
import { AVAILABILITY_MAX_AGE_MS, HOTSPOT_MAX_LAG_MS, isRecent, TAXI_MAX_AGE_MS } from "../entity/freshness";
import { STATIC_LAYERS, type LayerType, type StaticLayer } from "../entity/LayerType";
import type { LayerItems, MapDataRepository } from "../entity/MapDataRepository";
import type { CacheManager } from "../services/CacheManager";
import type { ApiResult, DataApiClient } from "../services/DataApiClient";
import { toCarpark } from "../services/toCarpark";
import { toChargingStation } from "../services/toChargingStation";
import { toFuelStation } from "../services/toFuelStation";
import { toHawkerCentre } from "../services/toHawkerCentre";
import { toHotspot } from "../services/toHotspot";
import { toTaxi } from "../services/toTaxi";
import { toTaxiStand } from "../services/toTaxiStand";
import type { DataSyncObserver } from "./DataSyncObserver";

/** Static layers are re-checked with the server once a day (D1). */
const STATIC_TTL_MS = 24 * 60 * 60 * 1000;

/** How one static layer gets from the cache or the server into the repository. */
interface LayerSync {
  loadCached(): Promise<void>;
  refresh(): Promise<void>;
}

/** The live layers' own toggles; carparks and charging stations also have live availability (D25). */
export type LiveLayer = "TAXIS" | "HOTSPOT";
export const LIVE_LAYERS: readonly LiveLayer[] = ["TAXIS", "HOTSPOT"];
type AvailabilityLayer = "CARPARK" | "CHARGING";
const AVAILABILITY_LAYERS: readonly AvailabilityLayer[] = ["CARPARK", "CHARGING"];

const isLive = (t: LayerType): t is LiveLayer => (LIVE_LAYERS as readonly LayerType[]).includes(t);
const hasAvailability = (t: LayerType): t is AvailabilityLayer =>
  (AVAILABILITY_LAYERS as readonly LayerType[]).includes(t);

/** The newest slot end among hotspots (all stations, LOW too): how recent the whole answer is. */
const latestSlot = (data: readonly HotspotDto[]) => new Date(Math.max(...data.map((h) => Date.parse(h.validTo))));

export class DataSyncController {
  private readonly api: DataApiClient;
  private readonly repo: MapDataRepository;
  private readonly cache: CacheManager;
  private readonly observers: DataSyncObserver[] = [];
  private readonly layers: Readonly<Record<StaticLayer, LayerSync>>;
  private readonly refreshes = new Map<StaticLayer, Promise<void>>();
  private readonly live: Readonly<Record<LiveLayer | AvailabilityLayer, LayerSync>>;
  private readonly liveRequests = new Map<LiveLayer | AvailabilityLayer, Promise<void>>();
  /** The latest availability per layer, put back whenever its static layer is replaced. */
  private readonly availability = new Map<AvailabilityLayer, { values: ReadonlyMap<string, number>; asOf: Date }>();

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
    this.live = {
      TAXIS: this.liveLayer(
        ENDPOINTS.taxis,
        TAXI_MAX_AGE_MS,
        (r) => new Date(r.asOf),
        (r) => {
          const seenAt = new Date(r.asOf);
          this.repo.replaceLayer(
            "TAXIS",
            r.data.map((dto) => toTaxi(dto, seenAt)),
          );
          this.notify("TAXIS");
        },
      ),
      HOTSPOT: this.liveLayer(
        ENDPOINTS.hotspots,
        HOTSPOT_MAX_LAG_MS,
        (r) => latestSlot(r.data),
        (r) => {
          this.repo.replaceLayer(
            "HOTSPOT",
            r.data.flatMap((dto) => toHotspot(dto) ?? []),
          );
          this.notify("HOTSPOT");
        },
      ),
      CARPARK: this.liveLayer(
        ENDPOINTS.carparkAvailability,
        AVAILABILITY_MAX_AGE_MS,
        (r) => new Date(r.asOf),
        (r) => {
          this.setAvailability("CARPARK", new Map(r.data.map((a) => [a.id, a.availableLots])), new Date(r.asOf));
        },
      ),
      CHARGING: this.liveLayer(
        ENDPOINTS.chargerAvailability,
        AVAILABILITY_MAX_AGE_MS,
        (r) => new Date(r.asOf),
        (r) => {
          this.setAvailability("CHARGING", new Map(r.data.map((a) => [a.id, a.availablePoints])), new Date(r.asOf));
        },
      ),
    } satisfies Record<LiveLayer | AvailabilityLayer, LayerSync>;
  }

  attach(o: DataSyncObserver): void {
    this.observers.push(o);
  }

  /** At startup: fill the repository with what earlier sessions saved, static and live. Never touches the network. */
  async loadCached(): Promise<void> {
    await Promise.all(STATIC_LAYERS.map((t) => this.layers[t].loadCached()));
    await Promise.all(Object.values(this.live).map((l) => l.loadCached())); // availability goes onto loaded layers
  }

  /**
   * The design model's refreshLive: brings the live data of `layers` up to date together (D25), including carpark and
   * charger availability for those layers. Never rejects; a toggle uses refreshLiveLayer to hear about failures.
   */
  async refreshLive(layers: ReadonlySet<LayerType>): Promise<void> {
    const wanted = [...layers].filter((t) => isLive(t) || hasAvailability(t));
    await Promise.allSettled(wanted.map((t) => this.requestLive(t)));
  }

  /** Brings one live layer up to date. Rejects only when there is nothing recent enough to show (D22, exception 4a). */
  refreshLiveLayer(t: LiveLayer): Promise<void> {
    return this.requestLive(t);
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

  /** One request at a time per live endpoint: a poll and a toggle arriving together share it. */
  private requestLive(t: LiveLayer | AvailabilityLayer): Promise<void> {
    let request = this.liveRequests.get(t);
    if (!request) {
      request = this.live[t].refresh().finally(() => this.liveRequests.delete(t));
      this.liveRequests.set(t, request);
    }
    return request;
  }

  private notify(t: LayerType): void {
    for (const o of this.observers) o.onDataUpdated(t);
  }

  private setAvailability(t: AvailabilityLayer, values: ReadonlyMap<string, number>, asOf: Date): void {
    this.availability.set(t, { values, asOf });
    this.repo.updateAvailability(t, values, asOf);
    this.notify(t);
  }

  /**
   * How one live endpoint gets into the repository: always asked (an unchanged answer is a cheap 304), and on failure
   * the saved copy is enough only while it is recent enough (D22).
   */
  private liveLayer<D>(
    endpoint: Endpoint<D[]>,
    maxAgeMs: number,
    observedAt: (r: ApiResponse<D[]>) => Date,
    apply: (r: ApiResponse<D[]>) => void,
  ): LayerSync {
    return {
      loadCached: async () => {
        const cached = await this.cache.get(endpoint.path, endpoint.response);
        if (cached) apply(cached);
      },

      refresh: async () => {
        const cached = await this.cache.get(endpoint.path, endpoint.response);
        let result: ApiResult<D[]>;
        try {
          result = await this.api.get(endpoint, cached?.etag);
        } catch (err) {
          if (cached && isRecent(observedAt(cached), new Date(), maxAgeMs)) return; // the saved copy still counts
          throw err;
        }
        if (result.status === "ok") {
          await this.cache.put(endpoint.path, result.response);
          apply(result.response);
        } else if (cached) {
          // 304 has no body, so the server's newer asOf never arrives; but it only says 304 because its latest sync
          // matched, so the copy counts as confirmed now. (Hotspots' age comes from their slots, not from asOf.)
          const confirmed = { ...cached, asOf: new Date().toISOString() };
          await this.cache.put(endpoint.path, confirmed);
          apply(confirmed);
        }
      },
    };
  }

  /** Ties one layer's endpoint, DTO-to-entity converter (D6) and repository slot together; the types must agree. */
  private staticLayer<K extends StaticLayer, D>(
    layer: K,
    endpoint: Endpoint<D[]>,
    toEntity: (dto: D) => LayerItems[K],
  ): LayerSync {
    const show = (data: readonly D[]) => {
      this.repo.replaceLayer(layer, data.map(toEntity));
      const live = hasAvailability(layer) ? this.availability.get(layer) : undefined;
      if (live && hasAvailability(layer)) this.repo.updateAvailability(layer, live.values, live.asOf); // keep it across a reload
      this.notify(layer);
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
