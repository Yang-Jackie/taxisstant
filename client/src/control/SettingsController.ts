import { isLayerType, type LayerType } from "../entity/LayerType";
import type { UserPreferences } from "../entity/UserPreferences";
import type { LocalStore } from "../services/LocalStore";
import { Store } from "./Store";

const KEY = "preferences";

/** The only owner of the driver's preferences (D3). Saves every change through LocalStore. */
export class SettingsController extends Store<UserPreferences> {
  private readonly localStore: Pick<LocalStore, "read" | "write">;

  constructor(localStore: Pick<LocalStore, "read" | "write">) {
    super({ visibleLayers: new Set() });
    this.localStore = localStore;
  }

  getPreferences(): UserPreferences {
    return this.getSnapshot();
  }

  isLayerVisible(t: LayerType): boolean {
    return this.getSnapshot().visibleLayers.has(t);
  }

  /** Restores what an earlier session saved. Anything unexpected in storage is ignored. */
  async load(): Promise<void> {
    const saved = await this.localStore.read(KEY);
    const layers =
      typeof saved === "object" && saved !== null && "visibleLayers" in saved && Array.isArray(saved.visibleLayers)
        ? saved.visibleLayers.filter(isLayerType)
        : [];
    this.setState({ ...this.getSnapshot(), visibleLayers: new Set(layers) });
  }

  async setLayerVisible(t: LayerType, on: boolean): Promise<void> {
    if (this.isLayerVisible(t) === on) return;
    const visibleLayers = new Set(this.getSnapshot().visibleLayers);
    if (on) visibleLayers.add(t);
    else visibleLayers.delete(t);
    this.setState({ ...this.getSnapshot(), visibleLayers });
    await this.localStore.write(KEY, { visibleLayers: [...visibleLayers] });
  }
}
