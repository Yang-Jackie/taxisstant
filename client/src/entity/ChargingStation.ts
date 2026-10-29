import { AVAILABILITY_MAX_AGE_MS, isRecent } from "./freshness";
import { Landmark, type LandmarkProps } from "./Landmark";
import type { StaticLayer } from "./LayerType";

export interface ChargingStationProps extends LandmarkProps {
  operators: readonly string[];
  chargePoints: number;
  maxPowerKw?: number;
  hasDcFast: boolean;
  plugTypes: readonly string[];
  availablePoints?: number;
  availabilityAsOf?: Date;
}

/** A place with EV chargers (FR-1.1.3). Its free chargers are live data (D22). */
export class ChargingStation extends Landmark {
  /** Several for a few places, so a list instead of the design model's single operator (D15). */
  readonly operators: readonly string[];
  readonly chargePoints: number;
  readonly maxPowerKw?: number;
  /** Whether any charger is DC fast charging (D15). */
  readonly hasDcFast: boolean;
  readonly plugTypes: readonly string[];
  /** Free chargers when last reported, and when that was: the design model's availablePoints. */
  readonly availablePoints?: number;
  readonly availabilityAsOf?: Date;

  constructor(props: ChargingStationProps) {
    super(props);
    this.operators = [...props.operators];
    this.chargePoints = props.chargePoints;
    this.maxPowerKw = props.maxPowerKw;
    this.hasDcFast = props.hasDcFast;
    this.plugTypes = [...props.plugTypes];
    this.availablePoints = props.availablePoints;
    this.availabilityAsOf = props.availabilityAsOf;
  }

  /** A copy with new free chargers (undefined: not reported). The original is left as it is. */
  withAvailability(availablePoints: number | undefined, asOf: Date): ChargingStation {
    return new ChargingStation({ ...this, location: this.location, availablePoints, availabilityAsOf: asOf });
  }

  /** Free chargers, if reported recently enough (D22). */
  availablePointsAt(now: Date): number | undefined {
    return this.availabilityAsOf && isRecent(this.availabilityAsOf, now, AVAILABILITY_MAX_AGE_MS)
      ? this.availablePoints
      : undefined;
  }

  getType(): StaticLayer {
    return "CHARGING";
  }
}
