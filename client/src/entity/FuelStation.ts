import { Landmark, type LandmarkProps } from "./Landmark";
import type { LayerType } from "./LayerType";

export interface FuelStationProps extends LandmarkProps {
  brand?: string;
  openingHours?: string;
}

/** A petrol station (FR-1.1.3), from OpenStreetMap (D12). The brand is unknown for a few stations. */
export class FuelStation extends Landmark {
  readonly brand?: string;
  /** In OpenStreetMap's opening_hours format, e.g. "24/7", where known. */
  readonly openingHours?: string;

  constructor(props: FuelStationProps) {
    super(props);
    this.brand = props.brand;
    this.openingHours = props.openingHours;
  }

  getType(): LayerType {
    return "FUEL";
  }
}
