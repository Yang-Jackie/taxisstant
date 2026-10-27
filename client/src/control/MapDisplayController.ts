import type { LayerType } from "../entity/LayerType";
import type { MapDataRepository } from "../entity/MapDataRepository";
import type { TaxiStand } from "../entity/TaxiStand";
import type { DataSyncController } from "./DataSyncController";
import type { DataSyncObserver } from "./DataSyncObserver";
import type { SettingsController } from "./SettingsController";
import { Store } from "./Store";

export interface MapDisplayState {
  /** What the map should draw right now, per layer. Phase 2 adds the other layers. */
  readonly visible: { readonly TAXI_STAND: readonly TaxiStand[] };
  /** A message for the user, shown as a toast (D3). */
  readonly notice: string | null;
}

const LOAD_FAILED = "Unable to load taxi stand markers. Please check your connection.";

export class MapDisplayController extends Store<MapDisplayState> implements DataSyncObserver {
  private readonly settings: SettingsController;
  private readonly dataSync: DataSyncController;
  private readonly repo: MapDataRepository;

  constructor(settings: SettingsController, dataSync: DataSyncController, repo: MapDataRepository) {
    super({ visible: { TAXI_STAND: [] }, notice: null });
    this.settings = settings;
    this.dataSync = dataSync;
    this.repo = repo;
    settings.subscribe(() => this.recompute());
  }

  /** At startup: if an earlier session left Taxi stands on, load them. */
  async start(): Promise<void> {
    if (this.settings.isLayerVisible("TAXI_STAND")) await this.load("TAXI_STAND");
  }

  async toggleLayer(t: LayerType): Promise<void> {
    const on = !this.settings.isLayerVisible(t);
    await this.settings.setLayerVisible(t, on);
    if (on && t === "TAXI_STAND") await this.load(t);
  }

  onDataUpdated(_t: LayerType): void {
    this.recompute();
  }

  dismissNotice(): void {
    this.setState({ ...this.getSnapshot(), notice: null });
  }

  private async load(t: LayerType): Promise<void> {
    try {
      await this.dataSync.refreshStatic();
    } catch {
      await this.settings.setLayerVisible(t, false);
      this.setState({ ...this.getSnapshot(), notice: LOAD_FAILED });
    }
  }

  private recompute(): void {
    const taxiStands = this.settings.isLayerVisible("TAXI_STAND") ? this.repo.getByLayerType("TAXI_STAND") : [];
    this.setState({ ...this.getSnapshot(), visible: { TAXI_STAND: taxiStands } });
  }
}
