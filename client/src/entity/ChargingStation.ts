import { Landmark, type LandmarkProps } from "./Landmark";
import type { LayerType } from "./LayerType";

export interface ChargingStationProps extends LandmarkProps {
  operators: readonly string[];
  chargePoints: number;
  maxPowerKw?: number;
  hasDcFast: boolean;
  plugTypes: readonly string[];
}

/** A place with EV chargers (FR-1.1.3). Free chargers (`availablePoints`) are live data, added in package 2d. */
export class ChargingStation extends Landmark {
  /** Several for a few places, so a list instead of the design model's single operator (D15). */
  readonly operators: readonly string[];
  readonly chargePoints: number;
  readonly maxPowerKw?: number;
  /** Whether any charger is DC fast charging (D15). */
  readonly hasDcFast: boolean;
  readonly plugTypes: readonly string[];

  constructor(props: ChargingStationProps) {
    super(props);
    this.operators = [...props.operators];
    this.chargePoints = props.chargePoints;
    this.maxPowerKw = props.maxPowerKw;
    this.hasDcFast = props.hasDcFast;
    this.plugTypes = [...props.plugTypes];
  }

  getType(): LayerType {
    return "CHARGING";
  }
}
