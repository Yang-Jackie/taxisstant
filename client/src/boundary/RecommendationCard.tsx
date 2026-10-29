import navigation from "@tabler/icons/outline/navigation.svg?raw";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import type { NavigationTarget } from "../control/NavigationController";
import { SEARCH_RADIUS_M, type NoResultsReason, type Recommendation } from "../control/RecommendationController";
import type { RecommendationKind } from "../entity/RecommendationKind";
import type { SuggestedSite } from "../entity/SuggestedSite";
import { clock, distance } from "./format";
import { summaryOf } from "./summaries";

/** What an empty list says, so the driver knows whether to wait, reconnect, or drive on. */
function emptyText(k: RecommendationKind, reason: NoResultsReason, t: TFunction): string {
  switch (reason) {
    case "NO_POSITION":
      return t("suggestions.waiting");
    case "OUT_OF_DATE":
      return t("suggestions.outOfDate");
    case "NONE_NEARBY":
      return t(`suggestions.noneWithin.${k}`, { km: SEARCH_RADIUS_M[k] / 1000 });
  }
}

export interface RecommendationCardProps {
  kind: RecommendationKind;
  items: readonly Recommendation[];
  /** Why there are no items, if there are none. */
  reason?: NoResultsReason;
  /** A site was chosen: the dialog map's "show on the map". */
  onSelect: (site: SuggestedSite) => void;
  /** The design model's RecommendationCard.onNavigate: route there (UC 0012, D39). */
  onNavigate?: (target: NavigationTarget) => void;
}

/** The design model's RecommendationCard: one suggestion's best sites, nearest best first (D33, D34). */
export function RecommendationCard({ kind, items, reason, onSelect, onNavigate }: RecommendationCardProps) {
  const { t } = useTranslation();
  if (items.length === 0) {
    return <p className="recommendation-card__empty">{reason ? emptyText(kind, reason, t) : null}</p>;
  }
  return (
    <div className="recommendation-card">
      <ol>
        {items.map(({ site, distanceM }, i) => (
          <li key={site.id}>
            <button type="button" onClick={() => onSelect(site)}>
              <span className="recommendation-card__place" aria-hidden="true">
                {i + 1}
              </span>
              <span className="recommendation-card__text">
                <span className="recommendation-card__name">{site.name}</span>
                <span className="recommendation-card__summary">{summaryOf(site, t)}</span>
              </span>
              <span className="recommendation-card__distance">{distance(distanceM, t)}</span>
            </button>
            {onNavigate && (
              <button
                type="button"
                className="recommendation-card__navigate"
                aria-label={t("place.navigateTo", { name: site.name })}
                onClick={() => onNavigate({ location: site.centre, name: site.name })}
                dangerouslySetInnerHTML={{ __html: navigation }}
              />
            )}
          </li>
        ))}
      </ol>
      <p className="recommendation-card__as-of">
        {t("suggestions.scoredAt", { time: clock.format(items[0]!.site.asOf) })}
      </p>
    </div>
  );
}
