// Package 6 tests — GPSInterface «boundary»: the browser's Geolocation API, as UC 0013 needs it.
import { describe, expect, it, vi } from "vitest";
import { fakeGeolocation } from "../testing/fakeGps";
import { GPSInterface } from "./GPSInterface";

describe("GPSInterface.watchPosition", () => {
  it("passes on each reading's coordinates, accuracy and time", () => {
    const gps = fakeGeolocation();
    const onFix = vi.fn();
    new GPSInterface(gps.geolocation).watchPosition(onFix, vi.fn());

    gps.move(1.3, 103.8, 25, Date.parse("2026-10-28T13:00:00Z"));

    expect(onFix).toHaveBeenCalledWith({
      latitude: 1.3,
      longitude: 103.8,
      accuracyM: 25,
      at: new Date("2026-10-28T13:00:00Z"),
    });
  });

  it("asks for GPS-level accuracy", () => {
    const gps = fakeGeolocation();
    new GPSInterface(gps.geolocation).watchPosition(vi.fn(), vi.fn());
    expect(gps.geolocation.watchPosition.mock.calls[0]![2]).toMatchObject({ enableHighAccuracy: true });
  });

  it("calls a permission refusal 'denied', and anything else 'unavailable'", () => {
    const gps = fakeGeolocation();
    const onProblem = vi.fn();
    new GPSInterface(gps.geolocation).watchPosition(vi.fn(), onProblem);
    gps.fail(1);
    gps.fail(2);
    gps.fail(3);
    expect(onProblem.mock.calls.map(([p]) => p)).toEqual(["denied", "unavailable", "unavailable"]);
  });

  it("stops watching when the returned function is called", () => {
    const gps = fakeGeolocation();
    const stop = new GPSInterface(gps.geolocation).watchPosition(vi.fn(), vi.fn());
    stop();
    expect(gps.geolocation.clearWatch).toHaveBeenCalledWith(7);
  });

  it("says 'unavailable' at once on a browser without geolocation", () => {
    const onProblem = vi.fn();
    new GPSInterface(undefined).watchPosition(vi.fn(), onProblem);
    expect(onProblem).toHaveBeenCalledWith("unavailable");
  });
});
