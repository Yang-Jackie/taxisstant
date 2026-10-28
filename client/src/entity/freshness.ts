// How old live data may be and still show (D22). Older counts as nothing to show. The limits are shared with the
// server, which builds its suggested sites from the same data (D28, D29).
export { AVAILABILITY_MAX_AGE_MS, HOTSPOT_MAX_LAG_MS, TAXI_MAX_AGE_MS } from "@taxisstant/shared";

/** Whether something observed at `at` is still recent enough at `now`. */
export const isRecent = (at: Date, now: Date, maxAgeMs: number) => now.getTime() - at.getTime() <= maxAgeMs;
