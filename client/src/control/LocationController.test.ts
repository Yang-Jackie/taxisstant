// Package 6 tests — LocationController «control» (UC 0013): watches the GPS, keeps only the last position (D32).
import { afterEach, describe, expect, it, vi } from "vitest";
import { GPSInterface } from "../services/GPSInterface";
import { fakeGeolocation } from "../testing/fakeGps";
import { LocationController } from "./LocationController";

function memoryStore(initial: Record<string, unknown> = {}) {
  const data = new Map<string, unknown>(Object.entries(initial));
  return {
    data,
    read: async (k: string) => data.get(k),
    write: vi.fn(async (k: string, v: unknown) => void data.set(k, v)),
  };
}
function setUp(saved: Record<string, unknown> = {}) {
  const gps = fakeGeolocation();
  const store = memoryStore(saved);
  const location = new LocationController(new GPSInterface(gps.geolocation), store);
  const observer = { onLocationUpdated: vi.fn() };
  location.attach(observer);
  return { gps, store, location, observer };
}
const T = Date.parse("2026-10-28T13:00:00Z");

afterEach(() => vi.useRealTimers());

describe("LocationController", () => {
  it("starts tracking the GPS, and tells observers each position as a live one", async () => {
    const { gps, location, observer } = setUp();
    await location.startTracking();

    gps.move(1.2931, 103.852, 25, T);

    expect(location.getSnapshot()).toMatchObject({ status: "tracking", position: { accuracyM: 25, live: true } });
    expect(location.getCurrentLocation()?.latitude).toBe(1.2931);
    expect(observer.onLocationUpdated).toHaveBeenCalledWith(expect.objectContaining({ live: true }));
  });

  it("rounds coordinates to six decimals and ignores junk readings (UC 0013's sanitized coordinates)", async () => {
    const { gps, location } = setUp();
    await location.startTracking();

    gps.move(1.29312345678, 103.85212345678, 25, T);
    gps.move(Number.NaN, 103.8, 25, T);

    expect(location.getCurrentLocation()).toMatchObject({ latitude: 1.293123, longitude: 103.852123 });
  });

  it("keeps only the latest position on the phone, at most every 15 seconds (D32)", async () => {
    const { gps, store, location } = setUp();
    await location.startTracking();

    gps.move(1.3, 103.8, 20, T);
    gps.move(1.31, 103.81, 20, T + 5_000); // too soon: not saved
    gps.move(1.32, 103.82, 20, T + 16_000);

    expect(store.write).toHaveBeenCalledTimes(2);
    expect(store.data.get("lastLocation")).toEqual({
      latitude: 1.32,
      longitude: 103.82,
      accuracyM: 20,
      at: new Date(T + 16_000).toISOString(),
    });
  });

  it("starts from the position saved last time, marked as not live, until the GPS answers", async () => {
    const saved = { lastLocation: { latitude: 1.35, longitude: 103.9, accuracyM: 30, at: "2026-10-27T10:00:00.000Z" } };
    const { gps, location, observer } = setUp(saved);

    await location.startTracking();
    expect(location.getSnapshot().position).toMatchObject({ live: false, accuracyM: 30 });
    expect(observer.onLocationUpdated).toHaveBeenCalledWith(expect.objectContaining({ live: false }));

    gps.move(1.3, 103.8, 20, T);
    expect(location.getSnapshot().position?.live).toBe(true);
  });

  it("ignores a saved position that isn't one (old format, or tampered with)", async () => {
    const { location } = setUp({ lastLocation: { latitude: "north", longitude: 103.9 } });
    await location.startTracking();
    expect(location.getSnapshot().position).toBeNull();
  });

  it("on permission denied: says so, greys the position (not live), and stops watching (UC 0013 1a)", async () => {
    const { gps, location } = setUp();
    await location.startTracking();
    gps.move(1.3, 103.8, 20, T);

    gps.fail(1);

    expect(location.getSnapshot()).toMatchObject({ status: "denied", position: { live: false } });
    expect(gps.geolocation.clearWatch).toHaveBeenCalled();
  });

  it("calls a timeout or a missing fix 'unavailable', and keeps watching", async () => {
    const { gps, location } = setUp();
    await location.startTracking();
    gps.fail(3);
    expect(location.getSnapshot().status).toBe("unavailable");
    expect(gps.watching()).toBe(true);
  });

  it("retry() watches again (the banner's Try again, D30)", async () => {
    const { gps, location } = setUp();
    await location.startTracking();
    gps.fail(1);

    location.retry();
    gps.move(1.3, 103.8, 20, T);

    expect(gps.geolocation.watchPosition).toHaveBeenCalledTimes(2);
    expect(location.getSnapshot().status).toBe("tracking");
  });

  it("stops the GPS while the app is in the background, and starts it again in front", async () => {
    const { gps, location } = setUp();
    await location.startTracking();

    location.setForeground(false);
    expect(gps.watching()).toBe(false);
    location.setForeground(true);
    expect(gps.watching()).toBe(true);
    expect(gps.geolocation.watchPosition).toHaveBeenCalledTimes(2);
  });

  it("reports 'unavailable' on a browser without geolocation", async () => {
    const location = new LocationController(new GPSInterface(undefined), memoryStore());
    await location.startTracking();
    expect(location.getSnapshot().status).toBe("unavailable");
  });
});
