import car from "@tabler/icons/outline/car.svg?raw";
import cup from "@tabler/icons/outline/cup.svg?raw";
import flame from "@tabler/icons/outline/flame.svg?raw";
import star from "@tabler/icons/outline/star.svg?raw";
import x from "@tabler/icons/outline/x.svg?raw";
import { useEffect } from "react";
import type { RecommendationState } from "../control/RecommendationController";
import { RECOMMENDATION_KINDS, type RecommendationKind } from "../entity/RecommendationKind";
import type { SuggestedSite } from "../entity/SuggestedSite";
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
  onClose: () => void;
}

/**
 * The mockup's drawer (the data dictionary's Sidemenu): Smart suggestions, each a toggle with its best sites below
 * it while on (D33). Language, Settings and Help & support join it in package 9.
 */
export function Sidemenu({ active, recommendations, onToggleSuggestion, onSelect, onClose }: SidemenuProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="sidemenu">
      <div className="sidemenu__overlay" aria-hidden="true" onClick={onClose} />
      <aside className="sidemenu__drawer" role="dialog" aria-modal="true" aria-label="Menu">
        <header className="sidemenu__brand">
          <span className="sidemenu__logo" dangerouslySetInnerHTML={{ __html: car }} />
          <span className="sidemenu__brand-text">
            <span className="sidemenu__name">Taxi Assistant</span>
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
                />
              )}
            </section>
          );
        })}
      </aside>
    </div>
  );
}
