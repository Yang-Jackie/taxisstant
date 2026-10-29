import type { LayerType } from "../entity/LayerType";
import type { RecommendationKind } from "../entity/RecommendationKind";

/**
 * Implemented by anything that wants to hear when DataSyncController has new data (Observer pattern). Each observer
 * implements what it listens for: map layers, suggestions, or both (D9).
 */
export interface DataSyncObserver {
  onDataUpdated?(t: LayerType): void;
  onRecommendationUpdated?(k: RecommendationKind): void;
}
