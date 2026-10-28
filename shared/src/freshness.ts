// How old live data may be and still count (D22). The client uses these to decide what to show, the server to
// decide what its suggested sites may be built from (D28, D29).

/** Taxi positions: UC 0002's "not older than 5 minutes". */
export const TAXI_MAX_AGE_MS = 5 * 60 * 1000;
/** Free carpark lots and chargers. */
export const AVAILABILITY_MAX_AGE_MS = 15 * 60 * 1000;
/** A hotspot's slot may have ended this long ago: LTA publishes each 10-minute slot 10–25 minutes late (D20). */
export const HOTSPOT_MAX_LAG_MS = 30 * 60 * 1000;
