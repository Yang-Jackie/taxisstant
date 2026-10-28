import { Landmark, type LandmarkProps } from "./Landmark";
import type { LayerType } from "./LayerType";

export interface CarparkProps extends LandmarkProps {
  agency: string;
  area?: string;
}

/** A carpark run by HDB, URA or LTA (FR-1.1.2). Free lots (`availableLots`) are live data, added in package 2d. */
export class Carpark extends Landmark {
  readonly agency: string;
  readonly area?: string;

  constructor(props: CarparkProps) {
    super(props);
    this.agency = props.agency;
    this.area = props.area;
  }

  getType(): LayerType {
    return "CARPARK";
  }
}
