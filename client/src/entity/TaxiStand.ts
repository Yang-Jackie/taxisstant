import { Landmark, type LandmarkProps } from "./Landmark";
import type { LayerType } from "./LayerType";

export interface TaxiStandProps extends LandmarkProps {
  standType: string;
  isBarrierFree: boolean;
}

export class TaxiStand extends Landmark {
  readonly standType: string;
  readonly isBarrierFree: boolean;

  constructor(props: TaxiStandProps) {
    super(props);
    this.standType = props.standType;
    this.isBarrierFree = props.isBarrierFree;
  }

  getType(): LayerType {
    return "TAXI_STAND";
  }
}
