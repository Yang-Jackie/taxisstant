import type { TaxiStandDto } from "@taxisstant/shared";
import type { MapDataRepository } from "../entity/MapDataRepository";
import type { DataApiClient } from "../services/DataApiClient";
import { toTaxiStand } from "../services/toTaxiStand";
import type { DataSyncObserver } from "./DataSyncObserver";

export class DataSyncController {
  private readonly api: DataApiClient;
  private readonly repo: MapDataRepository;
  private readonly observers: DataSyncObserver[] = [];
  private taxiStandsLoad: Promise<void> | null = null;

  constructor(api: DataApiClient, repo: MapDataRepository) {
    this.api = api;
    this.repo = repo;
  }

  attach(o: DataSyncObserver): void {
    this.observers.push(o);
  }

  /** Loads the static layers (taxi stands, for now) once per session. Calls made meanwhile share the same request. */
  refreshStatic(): Promise<void> {
    this.taxiStandsLoad ??= this.loadTaxiStands().catch((err: unknown) => {
      this.taxiStandsLoad = null; // forget the failure, so the next call tries again
      throw err;
    });
    return this.taxiStandsLoad;
  }

  private async loadTaxiStands(): Promise<void> {
    const result = await this.api.get<TaxiStandDto[]>("/taxi-stands");
    if (result.status !== "ok") return;
    this.repo.replaceLayer("TAXI_STAND", result.response.data.map(toTaxiStand));
    for (const o of this.observers) o.onDataUpdated("TAXI_STAND");
  }
}
