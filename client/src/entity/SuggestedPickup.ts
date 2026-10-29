import type { DensityLevel } from "./Hotspot";
import type { RecommendationKind } from "./RecommendationKind";
import { SuggestedSite, type SuggestedSiteProps } from "./SuggestedSite";

export interface SuggestedPickupProps extends SuggestedSiteProps {
  taxiCount: number;
  crowdDensity?: DensityLevel;
  stationName?: string;
}

/** A taxi stand scored for picking up passengers (UC 0009, D28): the design model's SuggestedPickup. */
export class SuggestedPickup extends SuggestedSite {
  /** Empty taxis within 300 m: the competition. */
  readonly taxiCount: number;
  /** The busiest station within 500 m, and its name; undefined when none is near. */
  readonly crowdDensity?: DensityLevel;
  readonly stationName?: string;

  constructor(props: SuggestedPickupProps) {
    super(props);
    this.taxiCount = props.taxiCount;
    this.crowdDensity = props.crowdDensity;
    this.stationName = props.stationName;
  }

  getKind(): RecommendationKind {
    return "PICKUP";
  }
}
