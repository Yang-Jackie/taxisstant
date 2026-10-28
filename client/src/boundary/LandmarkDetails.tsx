import { useState } from "react";
import { Carpark } from "../entity/Carpark";
import { ChargingStation } from "../entity/ChargingStation";
import { FuelStation } from "../entity/FuelStation";
import { HawkerCentre, type Closure } from "../entity/HawkerCentre";
import type { Landmark } from "../entity/Landmark";
import { TaxiStand } from "../entity/TaxiStand";

const shortDate = new Intl.DateTimeFormat("en-SG", { day: "numeric", month: "short", timeZone: "Asia/Singapore" });
const day = (isoDate: string) => shortDate.format(new Date(`${isoDate}T00:00:00+08:00`));
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
    return <p>{[`${item.agency} carpark`, item.area].filter(Boolean).join(" · ")}</p>;
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
    return (
      <>
        <p>{speed.filter(Boolean).join(" · ")}</p>
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
