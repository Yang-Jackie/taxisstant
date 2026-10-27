import type { LayerType } from "../entity/LayerType";

/** Implemented by anything that wants to hear when DataSyncController has new data (Observer pattern). */
export interface DataSyncObserver {
  onDataUpdated(t: LayerType): void;
}
