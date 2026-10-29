import car from "@tabler/icons/outline/car.svg?raw";
import cup from "@tabler/icons/outline/cup.svg?raw";
import flame from "@tabler/icons/outline/flame.svg?raw";
import bookmarkIcon from "@tabler/icons/outline/bookmarks.svg?raw";
import settingsIcon from "@tabler/icons/outline/settings.svg?raw";
import star from "@tabler/icons/outline/star.svg?raw";
import x from "@tabler/icons/outline/x.svg?raw";
import type { NavigationTarget } from "../control/NavigationController";
import type { RecommendationState } from "../control/RecommendationController";
import type { Bookmark } from "../entity/Bookmark";
import type { Location } from "../entity/Location";
import { RECOMMENDATION_KINDS, type RecommendationKind } from "../entity/RecommendationKind";
import type { SuggestedSite } from "../entity/SuggestedSite";
import { BookmarkPanel } from "./BookmarkPanel";
import { Drawer } from "./Drawer";
import { SUGGESTION_GROUP } from "./markerIcons";
import { RecommendationCard } from "./RecommendationCard";
import "./Sidemenu.css";

/** The mockup's words and icons for the two suggestions. */
const ENTRY: Record<RecommendationKind, { icon: string; title: string; subtitle: string }> = {
  PICKUP: { icon: flame, title: "Suggested pickup", subtitle: "Best place to find a fare now" },
  REST_STOP: { icon: cup, title: "Suggested rest stop", subtitle: "Parking, food & fuel nearby" },
};

export interface SidemenuProps {
  /** The suggestions that are on. */
  active: ReadonlySet<RecommendationKind>;
  recommendations: RecommendationState;
  /** The design model's Sidemenu.onToggleSuggestion. */
  onToggleSuggestion: (k: RecommendationKind) => void;
  onSelect: (site: SuggestedSite) => void;
  onNavigate?: (target: NavigationTarget) => void;
  /** The driver's bookmarks, newest first (D40). */
  bookmarks?: readonly Bookmark[];
  /** Where the driver is, to say how far each bookmark is. */
  driverAt?: Location;
  onSelectBookmark?: (b: Bookmark) => void;
  /** The dialog map's "Settings button pressed". */
  onOpenSettings?: () => void;
  onClose: () => void;
}

/**
 * The mockup's drawer (the data dictionary's Sidemenu): Smart suggestions, each a toggle with its best sites below
 * it while on (D33), the driver's bookmarks (D40), and Settings. Language and Help & support join it in 9b and 9c.
 */
export function Sidemenu({
  active,
  recommendations,
  onToggleSuggestion,
  onSelect,
  onNavigate,
  bookmarks = [],
  driverAt,
  onSelectBookmark = () => {},
  onOpenSettings = () => {},
  onClose,
}: SidemenuProps) {
  return (
    <Drawer label="Menu" onClose={onClose}>
      <header className="sidemenu__brand">
        <span className="sidemenu__logo" dangerouslySetInnerHTML={{ __html: car }} />
        <span className="sidemenu__brand-text">
          <span className="sidemenu__name">TaxiMate</span>
          <span className="sidemenu__tagline">Singapore driver assistant</span>
        </span>
        <button
          type="button"
          className="sidemenu__close"
          aria-label="Close the menu"
          autoFocus
          onClick={onClose}
          dangerouslySetInnerHTML={{ __html: x }}
        />
      </header>
      <h2 className="sidemenu__label">
        <span dangerouslySetInnerHTML={{ __html: star }} />
        Smart suggestions
      </h2>
      {RECOMMENDATION_KINDS.map((k) => {
        const pending = recommendations.pending.has(k);
        return (
          <section key={k} className={`sidemenu__suggestion sidemenu__suggestion--${SUGGESTION_GROUP[k]}`}>
            <button
              type="button"
              className="sidemenu__toggle"
              aria-pressed={active.has(k)}
              aria-busy={pending}
              onClick={() => onToggleSuggestion(k)}
            >
              <span className="sidemenu__icon" dangerouslySetInnerHTML={{ __html: ENTRY[k].icon }} />
              <span className="sidemenu__toggle-text">
                <span className="sidemenu__title">{ENTRY[k].title}</span>
                <span className="sidemenu__subtitle">{pending ? "Finding the best nearby…" : ENTRY[k].subtitle}</span>
              </span>
            </button>
            {active.has(k) && (
              <RecommendationCard
                kind={k}
                items={recommendations.results[k]}
                reason={recommendations.noResults[k]}
                onSelect={onSelect}
                onNavigate={onNavigate}
              />
            )}
          </section>
        );
      })}
      <h2 className="sidemenu__label">
        <span dangerouslySetInnerHTML={{ __html: bookmarkIcon }} />
        Bookmarks
      </h2>
      <div className="sidemenu__bookmarks">
        <BookmarkPanel items={bookmarks} from={driverAt} onSelect={onSelectBookmark} />
      </div>
      <div className="sidemenu__divider" />
      <button type="button" className="sidemenu__item" onClick={onOpenSettings}>
        <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: settingsIcon }} />
        Settings
      </button>
    </Drawer>
  );
}
