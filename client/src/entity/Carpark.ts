import { AVAILABILITY_MAX_AGE_MS, isRecent } from "./freshness";
import { Landmark, type LandmarkProps } from "./Landmark";
import type { LayerType } from "./LayerType";

export interface CarparkProps extends LandmarkProps {
  agency: string;
  area?: string;
  availableLots?: number;
  availabilityAsOf?: Date;
}

/** A carpark run by HDB, URA or LTA (FR-1.1.2). Its free lots are live data (D19, D22). */
export class Carpark extends Landmark {
  readonly agency: string;
  readonly area?: string;
  /** Free car lots when last reported, and when that was. */
  readonly availableLots?: number;
  readonly availabilityAsOf?: Date;

  constructor(props: CarparkProps) {
    super(props);
    this.agency = props.agency;
    this.area = props.area;
    this.availableLots = props.availableLots;
    this.availabilityAsOf = props.availabilityAsOf;
  }

  /** A copy with new free lots (undefined: not reported). The original is left as it is. */
  withAvailability(availableLots: number | undefined, asOf: Date): Carpark {
    return new Carpark({ ...this, location: this.location, availableLots, availabilityAsOf: asOf });
  }

  /** Free lots, if reported recently enough (D22). */
  availableLotsAt(now: Date): number | undefined {
    return this.availabilityAsOf && isRecent(this.availabilityAsOf, now, AVAILABILITY_MAX_AGE_MS)
      ? this.availableLots
      : undefined;
  }

  getType(): LayerType {
    return "CARPARK";
  }
}
