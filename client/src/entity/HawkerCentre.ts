import { Landmark, type LandmarkProps } from "./Landmark";
import type { StaticLayer } from "./LayerType";

/** A day range when a centre is closed, in Singapore dates (yyyy-mm-dd, both days included). */
export interface Closure {
  readonly from: string;
  readonly to: string;
  readonly reason: "cleaning" | "works";
  readonly remarks?: string;
}

export interface HawkerCentreProps extends LandmarkProps {
  foodStalls: number;
  marketStalls: number;
  closures: readonly Closure[];
}

const singaporeDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Singapore",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The Singapore calendar date of an instant, as yyyy-mm-dd, whatever time zone the phone is set to. */
export function singaporeDate(t: Date): string {
  return singaporeDay.format(t);
}

/**
 * A hawker centre (FR-1.1.1). Centres have no opening hours of their own (their stalls do), so the design model's
 * operatingHours becomes NEA's closures for cleaning and works, and isOpen(t) checks those (D13).
 */
export class HawkerCentre extends Landmark {
  readonly foodStalls: number;
  readonly marketStalls: number;
  readonly closures: readonly Closure[];

  constructor(props: HawkerCentreProps) {
    super(props);
    this.foodStalls = props.foodStalls;
    this.marketStalls = props.marketStalls;
    this.closures = [...props.closures].sort((a, b) => a.from.localeCompare(b.from));
  }

  getType(): StaticLayer {
    return "HAWKER";
  }

  /** The closure covering the Singapore date of `t`, if there is one. */
  closureOn(t: Date): Closure | undefined {
    const day = singaporeDate(t);
    return this.closures.find((c) => c.from <= day && day <= c.to);
  }

  isOpen(t: Date): boolean {
    return this.closureOn(t) === undefined;
  }

  /** The next closure that starts after the Singapore date of `t`. */
  nextClosure(t: Date): Closure | undefined {
    const day = singaporeDate(t);
    return this.closures.find((c) => c.from > day);
  }
}
