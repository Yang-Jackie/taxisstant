import type { Location } from "../entity/Location";

/** Opens a URL in a new tab or app; the browser's window.open by default. */
export type Opener = (url: string) => void;

/** The Google Maps link to `dest` (D41): directions by car from wherever the phone is, which Google Maps works out. */
export function directionsUrl(dest: Location): string {
  const query = new URLSearchParams({
    api: "1",
    destination: `${dest.latitude},${dest.longitude}`,
    travelmode: "driving",
  });
  return `https://www.google.com/maps/dir/?${query}`;
}

/**
 * Hands routing off to Google Maps (UC 0012, FR-1.4.1): the design model's NavigationGateway «boundary». On a phone
 * with the Google Maps app, the link opens the app. It must be called straight from a tap, or browsers block it.
 */
export class NavigationGateway {
  private readonly open: Opener;

  constructor(open: Opener = (url) => void window.open(url, "_blank", "noopener,noreferrer")) {
    this.open = open;
  }

  /** The design model's openDeepLink, with the destination only: the driver's position stays on the phone (D41). */
  openDeepLink(dest: Location): void {
    this.open(directionsUrl(dest));
  }
}
