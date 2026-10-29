import { z } from "zod";
import { isLayerType, type LayerType } from "../entity/LayerType";
import { isRecommendationKind, type RecommendationKind } from "../entity/RecommendationKind";
import type { UserPreferences } from "../entity/UserPreferences";
import type { LocalStore } from "../services/LocalStore";
import { Store } from "./Store";

const KEY = "preferences";

/** A saved list of names, keeping only the ones `isName` knows (stored data may be old or tampered with). */
const namesOf = <T>(isName: (v: unknown) => v is T) =>
  z
    .array(z.unknown())
    .catch([])
    .transform((values) => values.filter(isName));

/** What is saved: plain arrays and objects, as IndexedDB keeps them. Anything missing or unexpected reads as empty. */
const SavedPreferences = z.object({
  visibleLayers: namesOf(isLayerType),
  activeSuggestions: namesOf(isRecommendationKind),
  suggestionLayers: z.record(z.string(), z.unknown()).catch({}),
  skipNavPrompt: z.boolean().catch(false),
});

/** The only owner of the driver's preferences (D3). Saves every change through LocalStore. */
export class SettingsController extends Store<UserPreferences> {
  private readonly localStore: Pick<LocalStore, "read" | "write">;

  constructor(localStore: Pick<LocalStore, "read" | "write">) {
    super({
      visibleLayers: new Set(),
      activeSuggestions: new Set(),
      suggestionLayers: new Map(),
      skipNavPrompt: false,
    });
    this.localStore = localStore;
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
    const { visibleLayers, activeSuggestions, suggestionLayers, skipNavPrompt } = saved.data;
    const visible = new Set(visibleLayers);
    const active = new Set(activeSuggestions);
    // A suggestion owns only layers that are still on, and only while it is on itself
    const owned = new Map<RecommendationKind, ReadonlySet<LayerType>>();
    for (const k of active) {
      const layers = namesOf(isLayerType).parse(suggestionLayers[k]);
      owned.set(k, new Set(layers.filter((t) => visible.has(t))));
    }
    this.setState({
      ...this.getSnapshot(),
      visibleLayers: visible,
      activeSuggestions: active,
      suggestionLayers: owned,
      skipNavPrompt,
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
    const suggestionLayers = new Map(
      [...this.getSnapshot().suggestionLayers].map(([k, layers]) => [k, new Set([...layers].filter((l) => l !== t))]),
    );
    await this.save({ ...this.getSnapshot(), visibleLayers, suggestionLayers });
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

  private async save(next: UserPreferences): Promise<void> {
    this.setState(next);
    await this.localStore.write(KEY, {
      visibleLayers: [...next.visibleLayers],
      activeSuggestions: [...next.activeSuggestions],
      suggestionLayers: Object.fromEntries([...next.suggestionLayers].map(([k, layers]) => [k, [...layers]])),
      skipNavPrompt: next.skipNavPrompt,
    });
  }
}
