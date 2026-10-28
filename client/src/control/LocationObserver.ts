import type { DriverPosition } from "../entity/DriverPosition";

/** Told whenever the driver's position changes (the design model's LocationObserver). */
export interface LocationObserver {
  onLocationUpdated(position: DriverPosition): void;
}
