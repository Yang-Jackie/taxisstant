/** One reading from the device (UC 0013 step 1): coordinates, accuracy and time. Heading and speed aren't used yet. */
export interface GpsFix {
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracyM: number;
  readonly at: Date;
}

export type GpsProblem = "denied" | "unavailable";

/** The browser's Geolocation API, as much of it as the app uses: watch, and permission changes where supported. */
export interface GeolocationLike {
  watchPosition: Geolocation["watchPosition"];
  clearWatch: Geolocation["clearWatch"];
}

/**
 * The design model's GPSInterface «boundary» (in services/, as the layered diagram places it): watches the device's
 * position through the browser. Needs a secure context (HTTPS, or localhost in development).
 */
export class GPSInterface {
  private readonly geolocation: GeolocationLike | undefined;

  constructor(geolocation: GeolocationLike | undefined = globalThis.navigator?.geolocation) {
    this.geolocation = geolocation;
  }

  /** The design model's watchPosition(cb). Calls `onFix` for each reading, `onProblem` when none can be had. Returns a stop function. */
  watchPosition(onFix: (fix: GpsFix) => void, onProblem: (problem: GpsProblem) => void): () => void {
    const geolocation = this.geolocation;
    if (!geolocation) {
      onProblem("unavailable");
      return () => {};
    }
    const id = geolocation.watchPosition(
      (p) =>
        onFix({
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          accuracyM: p.coords.accuracy,
          at: new Date(p.timestamp),
        }),
      (e) => onProblem(e.code === e.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 },
    );
    return () => geolocation.clearWatch(id);
  }
}
