import car from "@tabler/icons/outline/car.svg?raw";
import cup from "@tabler/icons/outline/cup.svg?raw";
import flame from "@tabler/icons/outline/flame.svg?raw";
import bookmarkIcon from "@tabler/icons/outline/bookmarks.svg?raw";
import settingsIcon from "@tabler/icons/outline/settings.svg?raw";
import worldIcon from "@tabler/icons/outline/world.svg?raw";
import star from "@tabler/icons/outline/star.svg?raw";
import x from "@tabler/icons/outline/x.svg?raw";
import { useTranslation } from "react-i18next";
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

/** The mockup's icons for the two suggestions. */
const ICON: Record<RecommendationKind, string> = { PICKUP: flame, REST_STOP: cup };

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
  /** The dialog map's "Language selection button pressed". */
  onOpenLanguage?: () => void;
  /** The dialog map's "Settings button pressed". */
  onOpenSettings?: () => void;
  onClose: () => void;
}

/**
 * The mockup's drawer (the data dictionary's Sidemenu): Smart suggestions, each a toggle with its best sites below
 * it while on (D33), the driver's bookmarks (D40), then Language and Settings. Help & support joins it in 9c.
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
  onOpenLanguage = () => {},
  onOpenSettings = () => {},
  onClose,
}: SidemenuProps) {
  const { t } = useTranslation();
  return (
    <Drawer label={t("menu.label")} onClose={onClose}>
      <header className="sidemenu__brand">
        <span className="sidemenu__logo" dangerouslySetInnerHTML={{ __html: car }} />
        <span className="sidemenu__brand-text">
          <span className="sidemenu__name">{t("app.name")}</span>
          <span className="sidemenu__tagline">{t("app.tagline")}</span>
        </span>
        <button
          type="button"
          className="sidemenu__close"
          aria-label={t("menu.close")}
          autoFocus
          onClick={onClose}
          dangerouslySetInnerHTML={{ __html: x }}
        />
      </header>
      <h2 className="sidemenu__label">
        <span dangerouslySetInnerHTML={{ __html: star }} />
        {t("menu.suggestions")}
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
              <span className="sidemenu__icon" dangerouslySetInnerHTML={{ __html: ICON[k] }} />
              <span className="sidemenu__toggle-text">
                <span className="sidemenu__title">{t(`menu.entry.${k}.title`)}</span>
                <span className="sidemenu__subtitle">
                  {pending ? t("menu.finding") : t(`menu.entry.${k}.subtitle`)}
                </span>
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
        {t("menu.bookmarks")}
      </h2>
      <div className="sidemenu__bookmarks">
        <BookmarkPanel items={bookmarks} from={driverAt} onSelect={onSelectBookmark} />
      </div>
      <div className="sidemenu__divider" />
      <button type="button" className="sidemenu__item" onClick={onOpenLanguage}>
        <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: worldIcon }} />
        {t("language.heading")}
      </button>
      <button type="button" className="sidemenu__item" onClick={onOpenSettings}>
        <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: settingsIcon }} />
        {t("menu.settings")}
      </button>
    </Drawer>
  );
}
