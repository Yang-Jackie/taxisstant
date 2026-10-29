import starFilled from "@tabler/icons/filled/star.svg?raw";
import navigation from "@tabler/icons/outline/navigation.svg?raw";
import star from "@tabler/icons/outline/star.svg?raw";
import type { TFunction } from "i18next";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { NavigationTarget } from "../control/NavigationController";
import type { Recommendation } from "../control/RecommendationController";
import { bookmarkIdOf } from "../entity/Bookmark";
import { Carpark } from "../entity/Carpark";
import { ChargingStation } from "../entity/ChargingStation";
import { FuelStation } from "../entity/FuelStation";
import { HawkerCentre, type Closure } from "../entity/HawkerCentre";
import type { Hotspot } from "../entity/Hotspot";
import type { Landmark } from "../entity/Landmark";
import { TaxiStand } from "../entity/TaxiStand";
import { clock, distance, shortDate } from "./format";
import { summaryOf } from "./summaries";

/** " · as of 20:50", in Singapore time: how old a live figure is (D22). */
const asOf = (at: Date | undefined, t: TFunction) => (at ? t("place.asOf", { time: clock.format(at) }) : "");
/** Why a hawker centre closes. NEA's remarks on other works are kept in its own words (English). */
const why = (c: Closure, t: TFunction) =>
  c.reason === "cleaning" ? t("place.closure.cleaning") : (c.remarks?.toLowerCase() ?? t("place.closure.works"));

/** What a place's popup can do (D39); without these, a popup only gives facts. */
export interface PlaceActions {
  /** The ids of the bookmarked landmarks, to light their stars. */
  readonly bookmarked: ReadonlySet<string>;
  readonly onToggleBookmark: (l: Landmark) => void;
  readonly onNavigate: (target: NavigationTarget) => void;
}

/** UC 0012's way in: the prompt, then Google Maps. */
function NavigateButton({
  target,
  onNavigate,
}: {
  target: NavigationTarget;
  onNavigate: (t: NavigationTarget) => void;
}) {
  const { t } = useTranslation();
  return (
    <button type="button" className="landmark-details__navigate" onClick={() => onNavigate(target)}>
      <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: navigation }} />
      {t("place.navigate")}
    </button>
  );
}

/**
 * UC 0011's star: unlit to bookmark, lit to take the bookmark away. Both icons are always there and CSS shows one:
 * React redraws the popup before a tap reaches the map, and Leaflet closes the popup for a tap whose target has left
 * the page, as a replaced icon would have.
 */
function StarButton({ item, actions }: { item: Landmark; actions: PlaceActions }) {
  const { t } = useTranslation();
  const on = actions.bookmarked.has(bookmarkIdOf(item));
  return (
    <button
      type="button"
      className="landmark-details__star"
      aria-pressed={on}
      aria-label={on ? t("place.unbookmark", { name: item.name }) : t("place.bookmark", { name: item.name })}
      onClick={() => actions.onToggleBookmark(item)}
    >
      <span className="landmark-details__star-off" dangerouslySetInnerHTML={{ __html: star }} />
      <span className="landmark-details__star-on" dangerouslySetInnerHTML={{ __html: starFilled }} />
    </button>
  );
}

function HawkerStatus({ centre, now }: { centre: HawkerCentre; now: Date }) {
  const { t, i18n } = useTranslation();
  const day = (isoDate: string) => shortDate(isoDate, i18n.language);
  const today = centre.closureOn(now);
  if (today) {
    return (
      <p className="landmark-details__alert">{t("place.closedToday", { why: why(today, t), date: day(today.to) })}</p>
    );
  }
  const next = centre.nextClosure(now);
  if (!next) return null;
  const range = next.from === next.to ? day(next.from) : `${day(next.from)} – ${day(next.to)}`;
  return <p>{t("place.nextClosed", { range, why: why(next, t) })}</p>;
}

/** A landmark's facts, by layer. Names, addresses, brands, plugs, operators and hours are the data's own words. */
function Facts({ item, now }: { item: Landmark; now: Date }) {
  const { t } = useTranslation();
  if (item instanceof TaxiStand) {
    return (
      <>
        <p>{item.standType === "Stop" ? t("place.taxiStand.Stop") : t("place.taxiStand.Stand")}</p>
        {item.isBarrierFree && <p>{t("place.barrierFree")}</p>}
      </>
    );
  }
  if (item instanceof Carpark) {
    const free = item.availableLotsAt(now);
    return (
      <>
        <p>{[t("place.carpark", { agency: item.agency }), item.area].filter(Boolean).join(" · ")}</p>
        {free !== undefined && (
          <p className="landmark-details__live">
            {t("place.lotsFree", { count: free })}
            {asOf(item.availabilityAsOf, t)}
          </p>
        )}
      </>
    );
  }
  if (item instanceof FuelStation) {
    return (
      <>
        {item.brand && !item.name.includes(item.brand) && <p>{item.brand}</p>}
        {item.location.address && <p>{item.location.address}</p>}
        {item.openingHours && <p>{t("place.openHours", { hours: item.openingHours })}</p>}
      </>
    );
  }
  if (item instanceof ChargingStation) {
    const speed = [
      t("place.chargers", { count: item.chargePoints }),
      item.maxPowerKw && t("place.upToKw", { kw: item.maxPowerKw }),
      item.hasDcFast && t("place.dcFast"),
    ];
    const free = item.availablePointsAt(now);
    return (
      <>
        <p>{speed.filter(Boolean).join(" · ")}</p>
        {free !== undefined && (
          <p className="landmark-details__live">
            {t("place.chargersFree", { free, total: item.chargePoints })}
            {asOf(item.availabilityAsOf, t)}
          </p>
        )}
        <p>{item.plugTypes.join(", ")}</p>
        {item.name !== item.location.address && <p>{item.location.address}</p>}
        <p className="landmark-details__muted">{item.operators.join(", ")}</p>
      </>
    );
  }
  if (item instanceof HawkerCentre) {
    return (
      <>
        <p>{item.location.address}</p>
        <p>{t("place.foodStalls", { count: item.foodStalls })}</p>
        <HawkerStatus centre={item} now={now} />
      </>
    );
  }
  return null;
}

/** What a hotspot's popup says: how busy the station's platforms were, and when (D20, D23). */
export function HotspotDetails({
  hotspot,
  onNavigate,
}: {
  hotspot: Hotspot;
  onNavigate?: (t: NavigationTarget) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="landmark-details">
      <h2>{hotspot.stationName}</h2>
      <p className="landmark-details__live">
        {t(`place.platforms.${hotspot.density}`)}
        {asOf(hotspot.validTo, t)}
      </p>
      <p className="landmark-details__muted">{hotspot.codes.join(" · ")}</p>
      {onNavigate && (
        <NavigateButton target={{ location: hotspot.centre, name: hotspot.stationName }} onNavigate={onNavigate} />
      )}
    </div>
  );
}

/** What a suggested site's popup says: why it was suggested, how far it is, and when it was scored (D34). */
export function SuggestionDetails({
  recommendation,
  onNavigate,
}: {
  recommendation: Recommendation;
  onNavigate?: (t: NavigationTarget) => void;
}) {
  const { t } = useTranslation();
  const { site, distanceM } = recommendation;
  return (
    <div className="landmark-details">
      <h2>{site.name}</h2>
      <p>{summaryOf(site, t)}</p>
      <p className="landmark-details__muted">
        {t("place.away", { distance: distance(distanceM, t) })}
        {asOf(site.asOf, t)}
      </p>
      {onNavigate && <NavigateButton target={{ location: site.centre, name: site.name }} onNavigate={onNavigate} />}
    </div>
  );
}

/**
 * What a marker's popup says about its landmark, by layer, with its star and Navigate when `actions` are given (D39).
 * `now` is read once, when the popup opens.
 */
export function LandmarkDetails({ item, now, actions }: { item: Landmark; now?: Date; actions?: PlaceActions }) {
  const [openedAt] = useState(() => now ?? new Date());
  return (
    <div className="landmark-details">
      <div className="landmark-details__head">
        <h2>{item.name}</h2>
        {actions && <StarButton item={item} actions={actions} />}
      </div>
      <Facts item={item} now={openedAt} />
      {actions && (
        <NavigateButton target={{ location: item.location, name: item.name }} onNavigate={actions.onNavigate} />
      )}
    </div>
  );
}
