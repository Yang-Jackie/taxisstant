// How old live data may be and still show (D22). Older counts as nothing to show.

/** Taxi positions: UC 0002's "not older than 5 minutes". */
export const TAXI_MAX_AGE_MS = 5 * 60 * 1000;
/** Free carpark lots and chargers. */
export const AVAILABILITY_MAX_AGE_MS = 15 * 60 * 1000;
/** A hotspot's slot may have ended this long ago: LTA publishes each 10-minute slot 10–25 minutes late (D20). */
export const HOTSPOT_MAX_LAG_MS = 30 * 60 * 1000;

/** Whether something observed at `at` is still recent enough at `now`. */
export const isRecent = (at: Date, now: Date, maxAgeMs: number) => now.getTime() - at.getTime() <= maxAgeMs;
