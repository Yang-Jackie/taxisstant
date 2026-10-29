import type { LayerType } from "./LayerType";
import type { RecommendationKind } from "./RecommendationKind";

/** The design model's VehicleType: what the driver refuels with. */
export type VehicleType = "FUEL" | "EV";

/** The driver's settings. The design model's language, font size and so on come in package 9. */
export interface UserPreferences {
  readonly visibleLayers: ReadonlySet<LayerType>;
  /** The suggestions that are on (UC 0008/0009). */
  readonly activeSuggestions: ReadonlySet<RecommendationKind>;
  /** The layers each suggestion turned on itself, which it turns off again with it (D35). */
  readonly suggestionLayers: ReadonlyMap<RecommendationKind, ReadonlySet<LayerType>>;
  /** Not chosen until the Settings page lets the driver choose (package 9). */
  readonly vehicleType?: VehicleType;
}
