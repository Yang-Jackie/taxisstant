import { HOTSPOT_MAX_LAG_MS, isRecent } from "./freshness";
import type { Location } from "./Location";
import { Site } from "./Site";

/** The design model's DensityLevel. Only MEDIUM and HIGH stations become hotspots (D23). */
export type DensityLevel = "LOW" | "MEDIUM" | "HIGH";

/** How far a hotspot's circle reaches: bigger for busier stations (D23). */
export const HOTSPOT_RADIUS_M: Record<"MEDIUM" | "HIGH", number> = { MEDIUM: 300, HIGH: 500 };

export interface HotspotProps {
  id: string;
  centre: Location;
  stationName: string;
  codes: readonly string[];
  density: "MEDIUM" | "HIGH";
  validFrom: Date;
  validTo: Date;
}

/** A busy MRT or LRT station (FR-1.2.3): the design model's Hotspot, a Site whose crowd level holds for one slot. */
export class Hotspot extends Site {
  readonly stationName: string;
  readonly codes: readonly string[];
  readonly density: "MEDIUM" | "HIGH";
  readonly validFrom: Date;
  readonly validTo: Date;

  constructor(props: HotspotProps) {
    super({ id: props.id, centre: props.centre, radius: HOTSPOT_RADIUS_M[props.density] });
    this.stationName = props.stationName;
    this.codes = [...props.codes];
    this.density = props.density;
    this.validFrom = props.validFrom;
    this.validTo = props.validTo;
  }

  /** Its slot ended recently enough to show (D22). */
  isCurrent(now: Date): boolean {
    return isRecent(this.validTo, now, HOTSPOT_MAX_LAG_MS);
  }
}
