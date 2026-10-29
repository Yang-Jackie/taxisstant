import type { RecommendationKind } from "./RecommendationKind";
import { SuggestedSite, type SuggestedSiteProps } from "./SuggestedSite";

export interface SuggestedRestStopProps extends SuggestedSiteProps {
  foodStalls: number;
  hasParking: boolean;
  freeLots?: number;
  hasFuel: boolean;
  hasCharging: boolean;
  freeChargePoints?: number;
}

/** A hawker centre scored for a rest stop (UC 0008, D29): the design model's SuggestedRestStop. */
export class SuggestedRestStop extends SuggestedSite {
  readonly foodStalls: number;
  /** A carpark within 500 m with free lots, or whose free lots aren't known; `freeLots` when they are. */
  readonly hasParking: boolean;
  readonly freeLots?: number;
  /** A petrol station within 500 m. */
  readonly hasFuel: boolean;
  /** EV chargers within 500 m; `freeChargePoints` when it is known how many are free. */
  readonly hasCharging: boolean;
  readonly freeChargePoints?: number;

  constructor(props: SuggestedRestStopProps) {
    super(props);
    this.foodStalls = props.foodStalls;
    this.hasParking = props.hasParking;
    this.freeLots = props.freeLots;
    this.hasFuel = props.hasFuel;
    this.hasCharging = props.hasCharging;
    this.freeChargePoints = props.freeChargePoints;
  }

  getKind(): RecommendationKind {
    return "REST_STOP";
  }
}
