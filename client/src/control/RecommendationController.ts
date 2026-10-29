import type { LayerType } from "../entity/LayerType";
import type { Location } from "../entity/Location";
import type { MapDataRepository, SuggestionItems } from "../entity/MapDataRepository";
import { RECOMMENDATION_KINDS, type RecommendationKind } from "../entity/RecommendationKind";
import { SuggestedRestStop } from "../entity/SuggestedRestStop";
import type { SuggestedSite } from "../entity/SuggestedSite";
import { hiddenEnergyLayer, type UserPreferences } from "../entity/UserPreferences";
import type { DataSyncController } from "./DataSyncController";
import type { DataSyncObserver } from "./DataSyncObserver";
import type { LocationController } from "./LocationController";
import type { LocationObserver } from "./LocationObserver";
import type { MapDisplayController } from "./MapDisplayController";
import type { SettingsController } from "./SettingsController";
import { Store } from "./Store";

/** A suggested site, and how far the driver is from it. */
export interface Recommendation<S extends SuggestedSite = SuggestedSite> {
  readonly site: S;
  readonly distanceM: number;
}

export type RecommendationResults = {
  readonly [K in RecommendationKind]: readonly Recommendation<SuggestionItems[K]>[];
};

/** Why a suggestion that is on has nothing to suggest right now. */
export type NoResultsReason = "NO_POSITION" | "OUT_OF_DATE" | "NONE_NEARBY";

export interface RecommendationState {
  /** The best sites near the driver, best first, per suggestion: the design model's results. Empty while off. */
  readonly results: RecommendationResults;
  /** Why a suggestion that is on has no results. */
  readonly noResults: Readonly<Partial<Record<RecommendationKind, NoResultsReason>>>;
  /** Suggestions being turned on, while their sites load. */
  readonly pending: ReadonlySet<RecommendationKind>;
}

/** How far away a site may be and still be suggested (D34): a fare is worth a shorter drive than a break. */
export const SEARCH_RADIUS_M: Readonly<Record<RecommendationKind, number>> = { PICKUP: 3_000, REST_STOP: 5_000 };
/** How many sites are suggested at once (D34): few enough to take in at a glance (NF-1). */
export const TOP_COUNT = 3;
/** A site this many kilometres away counts half as much as one right here (D34). */
const HALF_VALUE_KM = 1.5;
/** A rest stop with the driver's own energy stop counts this much more (D34). */
const ENERGY_BONUS = 1.25;

/** The layers each suggestion turns on with it (UC 0008/0009 step 5). */
export const RELATED_LAYERS: Readonly<Record<RecommendationKind, readonly LayerType[]>> = {
  PICKUP: ["TAXI_STAND", "TAXIS", "HOTSPOT"],
  REST_STOP: ["CHARGING", "FUEL", "CARPARK", "HAWKER"],
};

/** Exception 2a, in each use case's words. */
const LOAD_FAILED: Record<RecommendationKind, string> = {
  PICKUP: "Unable to load pickup markers. Please check your connection.",
  REST_STOP: "Unable to load rest stop markers. Please check your connection.",
};
/** Exception 4a, in each use case's words: nowhere to rank from, or nothing good enough near. */
const CANT_CALCULATE: Record<RecommendationKind, string> = {
  PICKUP: "Unable to calculate nearby pickup spots without your location. Please try again later.",
  REST_STOP: "Unable to calculate nearby rest stops without your location. Please try again later.",
};
const NONE_NEARBY: Record<RecommendationKind, string> = {
  PICKUP: "There are no ideal pickup spots nearby. Please try again later.",
  REST_STOP: "There are no ideal rest stops nearby. Please try again later.",
};

const NOTHING: RecommendationResults = { PICKUP: [], REST_STOP: [] };

/** Whether a rest stop has what the driver's vehicle needs: fuel, or chargers that aren't known to be all taken. */
function hasEnergyFor(site: SuggestedSite, prefs: UserPreferences): boolean {
  if (!(site instanceof SuggestedRestStop)) return false;
  if (prefs.vehicleType === "FUEL") return site.hasFuel;
  if (prefs.vehicleType === "EV") return site.hasCharging && site.freeChargePoints !== 0;
  return false;
}

/**
 * The design model's rank: the best sites within reach of `from` for this driver, best first (D34). The server's score
 * counts for less the further away a site is, and for more at a rest stop with the driver's energy stop.
 */
export function rank<S extends SuggestedSite>(
  sites: readonly S[],
  from: Location,
  prefs: UserPreferences,
): Recommendation<S>[] {
  return sites
    .map((site) => ({ site, distanceM: from.distanceTo(site.centre) }))
    .filter((r) => r.distanceM <= SEARCH_RADIUS_M[r.site.getKind()])
    .map((r) => {
      const nearness = 1 / (1 + r.distanceM / 1000 / HALF_VALUE_KM);
      return { r, value: r.site.score * nearness * (hasEnergyFor(r.site, prefs) ? ENERGY_BONUS : 1) };
    })
    .sort((a, b) => b.value - a.value) // stable: equal values keep the server's order
    .slice(0, TOP_COUNT)
    .map(({ r }) => r);
}

/**
 * Smart suggestions (UC 0008/0009): the design model's RecommendationController «control». The server scores the
 * sites; this ranks them by where the driver is and what they drive, and keeps the ranking current as new scores
 * arrive and the driver moves.
 */
export class RecommendationController extends Store<RecommendationState> implements DataSyncObserver, LocationObserver {
  private readonly settings: SettingsController;
  private readonly dataSync: DataSyncController;
  private readonly repo: MapDataRepository;
  private readonly mapDisplay: MapDisplayController;
  private readonly location: Pick<LocationController, "getCurrentLocation">;
  /** Ranks a suggestion again when its sites stop being fresh, in case no newer ones arrive (D36). */
  private readonly expiry = new Map<RecommendationKind, ReturnType<typeof setTimeout>>();

  constructor(
    settings: SettingsController,
    dataSync: DataSyncController,
    repo: MapDataRepository,
    mapDisplay: MapDisplayController,
    location: Pick<LocationController, "getCurrentLocation">,
  ) {
    super({ results: NOTHING, noResults: {}, pending: new Set() });
    this.settings = settings;
    this.dataSync = dataSync;
    this.repo = repo;
    this.mapDisplay = mapDisplay;
    this.location = location;
    // The results follow the settings at once, whatever changed them, rather than once the change is saved
    settings.subscribe(() => {
      for (const k of RECOMMENDATION_KINDS) this.update(k);
    });
  }

  /**
   * At startup: bring the suggestions an earlier session left on up to date (they rank as their sites arrive). One
   * whose sites can't be loaded is switched off.
   */
  async start(): Promise<void> {
    const on = [...this.settings.getPreferences().activeSuggestions];
    await Promise.all(
      on.map(async (k) => {
        try {
          await this.dataSync.refreshSuggestions(k);
        } catch {
          await this.settings.setSuggestionActive(k, false);
          this.mapDisplay.showNotice(LOAD_FAILED[k]);
        }
      }),
    );
  }

  /**
   * The side menu's toggle (UC 0008/0009). On: load and rank the sites, and only if there are some, turn the
   * suggestion on with its related layers (D35). Off: turn it off with the layers it turned on.
   */
  async toggle(k: RecommendationKind, on: boolean): Promise<void> {
    if (this.settings.isSuggestionActive(k) === on) return; // a second tap while loading shares the same request
    if (!on) {
      await this.settings.setSuggestionActive(k, false);
      return;
    }

    this.setPending(k, true);
    try {
      await this.dataSync.refreshSuggestions(k);
    } catch {
      this.mapDisplay.showNotice(LOAD_FAILED[k]); // exception 2a: the toggle stays off
      return;
    } finally {
      this.setPending(k, false);
    }

    const { reason } = this.ranking(k);
    if (reason) {
      // Exception 4a; a list that went out of date while loading is 2a
      const notice = { NO_POSITION: CANT_CALCULATE, NONE_NEARBY: NONE_NEARBY, OUT_OF_DATE: LOAD_FAILED }[reason][k];
      this.mapDisplay.showNotice(notice);
      return;
    }
    const hidden = hiddenEnergyLayer(this.settings.getPreferences().vehicleType); // not the other energy (D43)
    const related = RELATED_LAYERS[k].filter((t) => t !== hidden);
    const turnedOn = await this.settings.setSuggestionActive(k, true, related);
    await this.mapDisplay.showLayers(turnedOn);
  }

  onRecommendationUpdated(k: RecommendationKind): void {
    if (this.settings.isSuggestionActive(k)) this.update(k);
  }

  /** The driver moved: rank again from the new position. */
  onLocationUpdated(): void {
    for (const k of this.settings.getPreferences().activeSuggestions) this.update(k);
  }

  /** Ranks one suggestion's sites from where the driver is now, or says why it can't. */
  private ranking<K extends RecommendationKind>(
    k: K,
  ): { results: Recommendation<SuggestionItems[K]>[]; reason?: NoResultsReason } {
    const from = this.location.getCurrentLocation();
    if (!from) return { results: [], reason: "NO_POSITION" };
    const sites = this.repo.getSuggestions(k);
    if (sites[0] && !sites[0].isFresh(new Date())) return { results: [], reason: "OUT_OF_DATE" };
    const results = rank(sites, from, this.settings.getPreferences());
    return results.length > 0 ? { results } : { results, reason: "NONE_NEARBY" };
  }

  /** Ranks one suggestion again (or clears it while off), and sets a wake-up for when its sites stop being fresh. */
  private update(k: RecommendationKind): void {
    clearTimeout(this.expiry.get(k));
    this.expiry.delete(k);
    const active = this.settings.isSuggestionActive(k);
    const { results, reason } = active ? this.ranking(k) : { results: [], reason: undefined };

    const state = this.getSnapshot();
    const noResults = { ...state.noResults };
    if (reason) noResults[k] = reason;
    else delete noResults[k];
    this.setState({ ...state, results: { ...state.results, [k]: results }, noResults });

    const newest = this.repo.getSuggestions(k)[0];
    if (active && newest?.isFresh(new Date())) {
      const wait = newest.freshUntil().getTime() - Date.now() + 1;
      this.expiry.set(
        k,
        setTimeout(() => this.update(k), wait),
      );
    }
  }

  private setPending(k: RecommendationKind, on: boolean): void {
    const pending = new Set(this.getSnapshot().pending);
    if (on) pending.add(k);
    else pending.delete(k);
    this.setState({ ...this.getSnapshot(), pending });
  }
}
