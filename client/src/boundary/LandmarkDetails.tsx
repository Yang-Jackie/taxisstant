import starFilled from "@tabler/icons/filled/star.svg?raw";
import navigation from "@tabler/icons/outline/navigation.svg?raw";
import star from "@tabler/icons/outline/star.svg?raw";
import { useState } from "react";
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
import { clock, distance } from "./format";

const shortDate = new Intl.DateTimeFormat("en-SG", { day: "numeric", month: "short", timeZone: "Asia/Singapore" });
const day = (isoDate: string) => shortDate.format(new Date(`${isoDate}T00:00:00+08:00`));
/** "as of 20:50", in Singapore time: how old a live figure is (D22). */
const asOf = (at: Date | undefined) => (at ? ` · as of ${clock.format(at)}` : "");
const range = (c: Closure) => (c.from === c.to ? day(c.from) : `${day(c.from)} – ${day(c.to)}`);
const why = (c: Closure) => (c.reason === "cleaning" ? "cleaning" : (c.remarks ?? "works").toLowerCase());

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
  return (
    <button type="button" className="landmark-details__navigate" onClick={() => onNavigate(target)}>
      <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: navigation }} />
      Navigate
    </button>
  );
}

/**
 * UC 0011's star: unlit to bookmark, lit to take the bookmark away. Both icons are always there and CSS shows one:
 * React redraws the popup before a tap reaches the map, and Leaflet closes the popup for a tap whose target has left
 * the page, as a replaced icon would have.
 */
function StarButton({ item, actions }: { item: Landmark; actions: PlaceActions }) {
  const on = actions.bookmarked.has(bookmarkIdOf(item));
  return (
    <button
      type="button"
      className="landmark-details__star"
      aria-pressed={on}
      aria-label={on ? `Remove the bookmark for ${item.name}` : `Bookmark ${item.name}`}
      onClick={() => actions.onToggleBookmark(item)}
    >
      <span className="landmark-details__star-off" dangerouslySetInnerHTML={{ __html: star }} />
      <span className="landmark-details__star-on" dangerouslySetInnerHTML={{ __html: starFilled }} />
    </button>
  );
}

function HawkerStatus({ centre, now }: { centre: HawkerCentre; now: Date }) {
  const today = centre.closureOn(now);
  if (today)
    return (
      <p className="landmark-details__alert">
        Closed today for {why(today)}, until {day(today.to)}
      </p>
    );
  const next = centre.nextClosure(now);
  return next ? (
    <p>
      Next closed {range(next)} for {why(next)}
    </p>
  ) : null;
}

function Facts({ item, now }: { item: Landmark; now: Date }) {
  if (item instanceof TaxiStand) {
    return (
      <>
        <p>Taxi {item.standType.toLowerCase()}</p>
        {item.isBarrierFree && <p>Barrier-free access</p>}
      </>
    );
  }
  if (item instanceof Carpark) {
    const free = item.availableLotsAt(now);
    return (
      <>
        <p>{[`${item.agency} carpark`, item.area].filter(Boolean).join(" · ")}</p>
        {free !== undefined && (
          <p className="landmark-details__live">
            {free} lot{free === 1 ? "" : "s"} free{asOf(item.availabilityAsOf)}
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
        {item.openingHours && <p>Open {item.openingHours}</p>}
      </>
    );
  }
  if (item instanceof ChargingStation) {
    const speed = [
      `${item.chargePoints} charger${item.chargePoints === 1 ? "" : "s"}`,
      item.maxPowerKw && `up to ${item.maxPowerKw} kW`,
      item.hasDcFast && "DC fast",
    ];
    const free = item.availablePointsAt(now);
    return (
      <>
        <p>{speed.filter(Boolean).join(" · ")}</p>
        {free !== undefined && (
          <p className="landmark-details__live">
            {free} of {item.chargePoints} free{asOf(item.availabilityAsOf)}
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
        <p>{item.foodStalls} food stalls</p>
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
  return (
    <div className="landmark-details">
      <h2>{hotspot.stationName}</h2>
      <p className="landmark-details__live">
        {hotspot.density === "HIGH" ? "Very crowded" : "Crowded"} platforms{asOf(hotspot.validTo)}
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
  const { site, distanceM } = recommendation;
  return (
    <div className="landmark-details">
      <h2>{site.name}</h2>
      <p>{site.summary}</p>
      <p className="landmark-details__muted">
        {distance(distanceM)} away{asOf(site.asOf)}
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
