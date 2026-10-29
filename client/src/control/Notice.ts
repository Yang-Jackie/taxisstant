import type { StaticLayer } from "../entity/LayerType";
import type { RecommendationKind } from "../entity/RecommendationKind";
import type { LiveData, LiveLayer } from "./DataSyncController";

/**
 * A toast (D3), as which message rather than its words: the screen words it in the driver's language (FR-2.1.2). Each
 * is a key under `toast` in the boundary's messages.
 */
export type NoticeKey =
  | `loadFailed.${StaticLayer | LiveLayer}`
  | "noHotspots"
  | `suggestionLoadFailed.${RecommendationKind}`
  | `cantCalculate.${RecommendationKind}`
  | `noneNearby.${RecommendationKind}`
  | "bookmarkAdded"
  | "bookmarkRemoved"
  | "bookmarkNotFound"
  | `outOfDate.${LiveData}`
  | "outOfDate.several";
