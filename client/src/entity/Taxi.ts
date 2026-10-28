import { isRecent, TAXI_MAX_AGE_MS } from "./freshness";
import type { Locatable } from "./Locatable";
import type { Location } from "./Location";

/** An available taxi (FR-1.2.2): the design model's Taxi, a Locatable with a position. Taxis are anonymous. */
export class Taxi implements Locatable {
  readonly position: Location;
  /** When the server saw this snapshot of taxis. */
  readonly seenAt: Date;

  constructor(position: Location, seenAt: Date) {
    this.position = position;
    this.seenAt = seenAt;
  }

  getLocation(): Location {
    return this.position;
  }

  /** Recent enough to show (D22). */
  isFresh(now: Date): boolean {
    return isRecent(this.seenAt, now, TAXI_MAX_AGE_MS);
  }
}
