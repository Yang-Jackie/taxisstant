// Test helper: a stand-in for the browser's Geolocation API that tests drive by hand.
import { vi } from "vitest";
import type { GeolocationLike } from "../services/GPSInterface";

export function fakeGeolocation() {
  let success: PositionCallback | undefined;
  let failure: PositionErrorCallback | null | undefined;
  const geolocation = {
    watchPosition: vi.fn<GeolocationLike["watchPosition"]>((onSuccess, onError) => {
      success = onSuccess;
      failure = onError;
      return 7;
    }),
    clearWatch: vi.fn<GeolocationLike["clearWatch"]>(() => {
      success = undefined;
      failure = undefined;
    }),
  };
  return {
    geolocation,
    /** The device reports a position. */
    move(latitude: number, longitude: number, accuracy = 20, at = Date.now()) {
      success?.({ coords: { latitude, longitude, accuracy }, timestamp: at } as GeolocationPosition);
    },
    /** The device reports a problem: 1 is PERMISSION_DENIED, 2 POSITION_UNAVAILABLE, 3 TIMEOUT. */
    fail(code: 1 | 2 | 3) {
      failure?.({
        code,
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
        message: "",
      } as GeolocationPositionError);
    },
    watching: () => success !== undefined,
  };
}
