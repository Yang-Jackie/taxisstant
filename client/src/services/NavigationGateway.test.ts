// Package 8 tests — NavigationGateway «boundary»: the Google Maps link (UC 0012, FR-1.4.1, D41).
import { describe, expect, it, vi } from "vitest";
import { Location } from "../entity/Location";
import { directionsUrl, NavigationGateway } from "./NavigationGateway";

const suntec = new Location(1.29375, 103.85718);

describe("directionsUrl", () => {
  it("is Google Maps' directions link by car to the destination, as its Maps URLs documentation gives it", () => {
    expect(directionsUrl(suntec)).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=1.29375%2C103.85718&travelmode=driving",
    );
  });

  it("has no starting point: Google Maps starts from the phone's own location, and ours stays on the phone (D41)", () => {
    expect(new URL(directionsUrl(suntec)).searchParams.has("origin")).toBe(false);
  });

  it("shows the route rather than starting turn-by-turn, so the driver can pick one (UC 0012 step 5)", () => {
    expect(new URL(directionsUrl(suntec)).searchParams.has("dir_action")).toBe(false);
  });
});

describe("NavigationGateway.openDeepLink", () => {
  it("opens the link", () => {
    const open = vi.fn<(url: string) => void>();
    new NavigationGateway(open).openDeepLink(suntec);
    expect(open).toHaveBeenCalledExactlyOnceWith(directionsUrl(suntec));
  });

  it("opens it in a new tab (or the Google Maps app) by default, leaving this one as it was", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    new NavigationGateway().openDeepLink(suntec);
    expect(open).toHaveBeenCalledExactlyOnceWith(directionsUrl(suntec), "_blank", "noopener,noreferrer");
    open.mockRestore();
  });
});
