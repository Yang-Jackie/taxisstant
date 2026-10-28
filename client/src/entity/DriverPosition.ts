import type { Location } from "./Location";

/**
 * Where the driver is (UC 0013): the design model's TaxiDriver.currentLocation, without a driver id (there are no
 * user accounts, D32).
 */
export interface DriverPosition {
  readonly location: Location;
  /** How far off the fix may be, in metres: drawn as a circle around the driver's dot. */
  readonly accuracyM: number;
  /** When the fix was taken. */
  readonly at: Date;
  /** False for the position saved by an earlier session, until the GPS answers again. */
  readonly live: boolean;
}
