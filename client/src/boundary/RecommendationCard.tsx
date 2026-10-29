import { SEARCH_RADIUS_M, type NoResultsReason, type Recommendation } from "../control/RecommendationController";
import type { RecommendationKind } from "../entity/RecommendationKind";
import type { SuggestedSite } from "../entity/SuggestedSite";
import { clock, distance } from "./format";

/** What an empty list says, so the driver knows whether to wait, reconnect, or drive on. */
function emptyText(k: RecommendationKind, reason: NoResultsReason): string {
  const km = SEARCH_RADIUS_M[k] / 1000;
  switch (reason) {
    case "NO_POSITION":
      return "Waiting for your location…";
    case "OUT_OF_DATE":
      return "These suggestions are out of date. Please check your connection.";
    case "NONE_NEARBY":
      return k === "PICKUP"
        ? `No ideal pickup spots within ${km} km right now.`
        : `No ideal rest stops within ${km} km right now.`;
  }
}

export interface RecommendationCardProps {
  kind: RecommendationKind;
  items: readonly Recommendation[];
  /** Why there are no items, if there are none. */
  reason?: NoResultsReason;
  /** A site was chosen: the dialog map's "show on the map". */
  onSelect: (site: SuggestedSite) => void;
}

/** The design model's RecommendationCard: one suggestion's best sites, nearest best first (D33, D34). */
export function RecommendationCard({ kind, items, reason, onSelect }: RecommendationCardProps) {
  if (items.length === 0) {
    return <p className="recommendation-card__empty">{reason ? emptyText(kind, reason) : null}</p>;
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
                <span className="recommendation-card__summary">{site.summary}</span>
              </span>
              <span className="recommendation-card__distance">{distance(distanceM)}</span>
            </button>
          </li>
        ))}
      </ol>
      <p className="recommendation-card__as-of">Scored at {clock.format(items[0]!.site.asOf)}</p>
    </div>
  );
}
