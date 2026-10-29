import { z } from "zod";
import { isLayerType, type LayerType } from "../entity/LayerType";
import { isRecommendationKind, type RecommendationKind } from "../entity/RecommendationKind";
import {
  hiddenEnergyLayer,
  TEXT_SIZES,
  type TextSize,
  type UserPreferences,
  type VehicleType,
} from "../entity/UserPreferences";
import type { LocalStore } from "../services/LocalStore";
import { Store } from "./Store";

const KEY = "preferences";

/** A saved list of names, keeping only the ones `isName` knows (stored data may be old or tampered with). */
const namesOf = <T>(isName: (v: unknown) => v is T) =>
  z
    .array(z.unknown())
    .catch([])
    .transform((values) => values.filter(isName));

/** What is saved: plain arrays and objects, as IndexedDB keeps them. Anything missing or unexpected reads as unset. */
const SavedPreferences = z.object({
  visibleLayers: namesOf(isLayerType),
  activeSuggestions: namesOf(isRecommendationKind),
  suggestionLayers: z.record(z.string(), z.unknown()).catch({}),
  skipNavPrompt: z.boolean().catch(false),
  vehicleType: z.enum(["FUEL", "EV"]).optional().catch(undefined),
  fontSize: z
    .number()
    .refine((n): n is TextSize => (TEXT_SIZES as readonly number[]).includes(n))
    .catch(100),
  /** Saved only once the driver has chosen; until then the phone decides (D44). */
  darkMode: z.boolean().optional().catch(undefined),
});

/** The phone's light or dark setting, as `window.matchMedia("(prefers-color-scheme: dark)")` gives it. */
export interface ColourSchemeQuery {
  readonly matches: boolean;
  addEventListener(type: "change", listener: () => void): void;
}

function phoneColourScheme(): ColourSchemeQuery {
  const query = typeof window === "undefined" ? undefined : window.matchMedia?.("(prefers-color-scheme: dark)");
  return query ?? { matches: false, addEventListener: () => {} };
}

/** The only owner of the driver's preferences (D3). Saves every change through LocalStore. */
export class SettingsController extends Store<UserPreferences> {
  private readonly localStore: Pick<LocalStore, "read" | "write">;
  private readonly phoneDark: ColourSchemeQuery;
  /** Dark mode as the driver chose it; undefined while the phone decides (D44). */
  private darkModeChosen: boolean | undefined;

  constructor(localStore: Pick<LocalStore, "read" | "write">, phoneDark: ColourSchemeQuery = phoneColourScheme()) {
    super({
      visibleLayers: new Set(),
      activeSuggestions: new Set(),
      suggestionLayers: new Map(),
      skipNavPrompt: false,
      fontSize: 100,
      darkMode: phoneDark.matches,
    });
    this.localStore = localStore;
    this.phoneDark = phoneDark;
    phoneDark.addEventListener("change", () => {
      if (this.darkModeChosen === undefined) this.setState({ ...this.getSnapshot(), darkMode: phoneDark.matches });
    });
  }

  getPreferences(): UserPreferences {
    return this.getSnapshot();
  }

  isLayerVisible(t: LayerType): boolean {
    return this.getSnapshot().visibleLayers.has(t);
  }

  isSuggestionActive(k: RecommendationKind): boolean {
    return this.getSnapshot().activeSuggestions.has(k);
  }

  /** Restores what an earlier session saved. Anything unexpected in storage is ignored. */
  async load(): Promise<void> {
    const saved = SavedPreferences.safeParse(await this.localStore.read(KEY));
    if (!saved.success) return; // not an object at all: keep the defaults
    const { visibleLayers, activeSuggestions, suggestionLayers, skipNavPrompt, vehicleType, fontSize, darkMode } =
      saved.data;
    const hidden = hiddenEnergyLayer(vehicleType);
    const visible = new Set(visibleLayers.filter((t) => t !== hidden));
    const active = new Set(activeSuggestions);
    // A suggestion owns only layers that are still on, and only while it is on itself
    const owned = new Map<RecommendationKind, ReadonlySet<LayerType>>();
    for (const k of active) {
      const layers = namesOf(isLayerType).parse(suggestionLayers[k]);
      owned.set(k, new Set(layers.filter((t) => visible.has(t))));
    }
    this.darkModeChosen = darkMode;
    this.setState({
      visibleLayers: visible,
      activeSuggestions: active,
      suggestionLayers: owned,
      skipNavPrompt,
      ...(vehicleType && { vehicleType }),
      fontSize,
      darkMode: darkMode ?? this.phoneDark.matches,
    });
  }

  /**
   * Shows or hides one layer: the driver's own choice, or a layer that failed to load. Either way the layer is no
   * longer one a suggestion turned on, so turning the suggestion off leaves it alone (D35).
   */
  async setLayerVisible(t: LayerType, on: boolean): Promise<void> {
    if (this.isLayerVisible(t) === on) return;
    const visibleLayers = new Set(this.getSnapshot().visibleLayers);
    if (on) visibleLayers.add(t);
    else visibleLayers.delete(t);
    await this.save({ ...this.getSnapshot(), visibleLayers, suggestionLayers: this.without(t) });
  }

  /**
   * Turns suggestion `k` on together with those of its `related` layers that are off, or off together with the layers
   * it turned on that are still its own (D35). Returns the layers it turned on or off.
   */
  async setSuggestionActive(
    k: RecommendationKind,
    on: boolean,
    related: readonly LayerType[] = [],
  ): Promise<LayerType[]> {
    if (this.isSuggestionActive(k) === on) return [];
    const prefs = this.getSnapshot();
    const activeSuggestions = new Set(prefs.activeSuggestions);
    const visibleLayers = new Set(prefs.visibleLayers);
    const suggestionLayers = new Map(prefs.suggestionLayers);
    let changed: LayerType[];
    if (on) {
      changed = related.filter((t) => !visibleLayers.has(t));
      activeSuggestions.add(k);
      for (const t of changed) visibleLayers.add(t);
      suggestionLayers.set(k, new Set(changed));
    } else {
      changed = [...(prefs.suggestionLayers.get(k) ?? [])].filter((t) => visibleLayers.has(t));
      activeSuggestions.delete(k);
      for (const t of changed) visibleLayers.delete(t);
      suggestionLayers.delete(k);
    }
    await this.save({ ...prefs, visibleLayers, activeSuggestions, suggestionLayers });
    return changed;
  }

  /** The navigation prompt's "Do not show this again" (the design model's setSkipNavPrompt). */
  async setSkipNavPrompt(on: boolean): Promise<void> {
    if (this.getSnapshot().skipNavPrompt === on) return;
    await this.save({ ...this.getSnapshot(), skipNavPrompt: on });
  }

  /**
   * The design model's setVehicleType, or undefined to show both energy layers again. The layer the vehicle has no
   * use for is turned off and hidden (FR-2.1.1, D43).
   */
  async setVehicleType(v: VehicleType | undefined): Promise<void> {
    const prefs = this.getSnapshot();
    if (prefs.vehicleType === v) return;
    const hidden = hiddenEnergyLayer(v);
    const visibleLayers = new Set([...prefs.visibleLayers].filter((t) => t !== hidden));
    const { vehicleType: _old, ...rest } = prefs;
    await this.save({
      ...rest,
      ...(v && { vehicleType: v }),
      visibleLayers,
      suggestionLayers: hidden ? this.without(hidden) : prefs.suggestionLayers,
    });
  }

  /** The design model's setDisplay. Changing dark mode makes it the driver's choice, which then sticks (D44). */
  async setDisplay(fontSize: TextSize, darkMode: boolean): Promise<void> {
    const prefs = this.getSnapshot();
    if (prefs.fontSize === fontSize && prefs.darkMode === darkMode) return;
    if (prefs.darkMode !== darkMode) this.darkModeChosen = darkMode;
    await this.save({ ...prefs, fontSize, darkMode });
  }

  /** Every suggestion's own layers, less `t`. */
  private without(t: LayerType): Map<RecommendationKind, ReadonlySet<LayerType>> {
    return new Map(
      [...this.getSnapshot().suggestionLayers].map(([k, layers]) => [k, new Set([...layers].filter((l) => l !== t))]),
    );
  }

  private async save(next: UserPreferences): Promise<void> {
    this.setState(next);
    await this.localStore.write(KEY, {
      visibleLayers: [...next.visibleLayers],
      activeSuggestions: [...next.activeSuggestions],
      suggestionLayers: Object.fromEntries([...next.suggestionLayers].map(([k, layers]) => [k, [...layers]])),
      skipNavPrompt: next.skipNavPrompt,
      ...(next.vehicleType && { vehicleType: next.vehicleType }),
      fontSize: next.fontSize,
      ...(this.darkModeChosen !== undefined && { darkMode: this.darkModeChosen }),
    });
  }
}
