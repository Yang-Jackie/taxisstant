import type { LayerType } from "./LayerType";
import type { RecommendationKind } from "./RecommendationKind";

/** The design model's Language (FR-2.1.2). */
export type Language = "EN" | "ZH";

/** The design model's VehicleType: what the driver refuels with. */
export type VehicleType = "FUEL" | "EV";

/** The text sizes on offer, as a percentage of the phone's normal size (the design model's fontSize). */
export const TEXT_SIZES = [100, 115, 130, 150] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

/** The energy layer a vehicle has no use for, hidden once its type is chosen (FR-2.1.1, D43). */
export function hiddenEnergyLayer(v: VehicleType | undefined): "CHARGING" | "FUEL" | undefined {
  if (v === "FUEL") return "CHARGING";
  if (v === "EV") return "FUEL";
  return undefined;
}

/** The driver's settings: the design model's UserPreferences. */
export interface UserPreferences {
  /** The phone's own language until the driver chooses (FR-2.1.2). */
  readonly language: Language;
  readonly visibleLayers: ReadonlySet<LayerType>;
  /** The suggestions that are on (UC 0008/0009). */
  readonly activeSuggestions: ReadonlySet<RecommendationKind>;
  /** The layers each suggestion turned on itself, which it turns off again with it (D35). */
  readonly suggestionLayers: ReadonlyMap<RecommendationKind, ReadonlySet<LayerType>>;
  /** What the driver refuels with; until chosen, both energy layers show (D43). */
  readonly vehicleType?: VehicleType;
  /** "Do not show this again" on the navigation prompt: Navigate opens Google Maps at once (UC 0012 step 2, D39). */
  readonly skipNavPrompt: boolean;
  readonly fontSize: TextSize;
  /** Dark menus and OneMap's Night map; the phone's own setting until the driver chooses (D44). */
  readonly darkMode: boolean;
}
