import type { LayerType } from "./LayerType";

/** The driver's settings. Only visibleLayers for now; the design model's other fields come in Phase 2. */
export interface UserPreferences {
  readonly visibleLayers: ReadonlySet<LayerType>;
}
