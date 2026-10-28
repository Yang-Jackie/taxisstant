import { useState } from "react";
import { Carpark } from "../entity/Carpark";
import { ChargingStation } from "../entity/ChargingStation";
import { FuelStation } from "../entity/FuelStation";
import { HawkerCentre, type Closure } from "../entity/HawkerCentre";
import type { Hotspot } from "../entity/Hotspot";
import type { Landmark } from "../entity/Landmark";
import { TaxiStand } from "../entity/TaxiStand";

const shortDate = new Intl.DateTimeFormat("en-SG", { day: "numeric", month: "short", timeZone: "Asia/Singapore" });
const day = (isoDate: string) => shortDate.format(new Date(`${isoDate}T00:00:00+08:00`));
const clock = new Intl.DateTimeFormat("en-SG", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Singapore",
});
/** "as of 20:50", in Singapore time: how old a live figure is (D22). */
const asOf = (at: Date | undefined) => (at ? ` · as of ${clock.format(at)}` : "");
const range = (c: Closure) => (c.from === c.to ? day(c.from) : `${day(c.from)} – ${day(c.to)}`);
const why = (c: Closure) => (c.reason === "cleaning" ? "cleaning" : (c.remarks ?? "works").toLowerCase());

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
export function HotspotDetails({ hotspot }: { hotspot: Hotspot }) {
  return (
    <div className="landmark-details">
      <h2>{hotspot.stationName}</h2>
      <p className="landmark-details__live">
        {hotspot.density === "HIGH" ? "Very crowded" : "Crowded"} platforms{asOf(hotspot.validTo)}
      </p>
      <p className="landmark-details__muted">{hotspot.codes.join(" · ")}</p>
    </div>
  );
}

/** What a marker's popup says about its landmark, by layer. `now` is read once, when the popup opens. */
export function LandmarkDetails({ item, now }: { item: Landmark; now?: Date }) {
  const [openedAt] = useState(() => now ?? new Date());
  return (
    <div className="landmark-details">
      <h2>{item.name}</h2>
      <Facts item={item} now={openedAt} />
    </div>
  );
}
