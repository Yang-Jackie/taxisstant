// M4 acceptance tests — MapView «boundary»: the full-screen OneMap map with markers.
// jsdom has no real screen, so map tiles never load in tests — but markers and the credit line do.
// Package 2b: every static layer in the mockup's marker style, clusters (D17), the OSM credit (D12), onPan (FR-1.5.3).
import { fireEvent, render, screen } from "@testing-library/react";
import { Marker } from "leaflet";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Cluster, LayerView } from "../control/LayerClusters";
import type { VisibleLayers } from "../control/MapDisplayController";
import { Carpark } from "../entity/Carpark";
import type { Viewport } from "../entity/Bounds";
import { FuelStation } from "../entity/FuelStation";
import { Hotspot } from "../entity/Hotspot";
import { Location } from "../entity/Location";
import { Taxi } from "../entity/Taxi";
import { SuggestedPickup } from "../entity/SuggestedPickup";
import { SuggestedRestStop } from "../entity/SuggestedRestStop";
import { TaxiStand } from "../entity/TaxiStand";
import type { PlaceActions } from "./LandmarkDetails";
import { MapView } from "./MapView";

function stand(id: string, name: string, latitude: number, longitude: number) {
  return new TaxiStand({
    id,
    name,
    location: new Location(latitude, longitude),
    standType: "Stand",
    isBarrierFree: true,
  });
}
const stands = [
  stand("A01", "Orchard Rd along driveway of Lucky Plaza", 1.304294727, 103.8338467),
  stand("A05", "Mt Elizabeth Rd at Mt Elizabeth Hospital", 1.304571786, 103.835547),
];
const shell = new FuelStation({
  id: "way/1",
  name: "Shell Dunearn",
  location: new Location(1.33, 103.8),
  brand: "Shell",
});
const suntec = new Carpark({ id: "1", name: "Suntec City", location: new Location(1.29375, 103.85718), agency: "LTA" });
const carparkCluster: Cluster = { id: "7", count: 3, location: new Location(1.36, 103.84), zoomTo: 15 };

const nothing: LayerView<never> = { items: [], clusters: [] };
function visibleWith(layers: Partial<VisibleLayers> = {}): VisibleLayers {
  return {
    TAXI_STAND: nothing,
    TAXIS: nothing,
    HOTSPOT: nothing,
    CARPARK: nothing,
    FUEL: nothing,
    CHARGING: nothing,
    HAWKER: nothing,
    ...layers,
  };
}

const markers = (container: HTMLElement) => container.querySelectorAll(".leaflet-marker-icon");

/** jsdom lays nothing out, so every element is 0×0; give the map a phone-sized box. */
function withScreenSize() {
  vi.spyOn(Element.prototype, "clientWidth", "get").mockReturnValue(400);
  vi.spyOn(Element.prototype, "clientHeight", "get").mockReturnValue(800);
}

afterEach(() => vi.restoreAllMocks());

describe("MapView", () => {
  it("draws a Leaflet map", () => {
    const { container } = render(<MapView visible={visibleWith()} />);
    expect(container.querySelector(".leaflet-container")).not.toBeNull();
  });

  it("credits OneMap and the Singapore Land Authority, as OneMap's terms require", () => {
    render(<MapView visible={visibleWith()} />);
    expect(screen.getByRole("link", { name: "OneMap" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Singapore Land Authority" })).toBeInTheDocument();
  });

  it("shows no markers when nothing is visible", () => {
    const { container } = render(<MapView visible={visibleWith()} />);
    expect(markers(container)).toHaveLength(0);
  });

  it("shows one marker per visible item, in every static layer", () => {
    const { container } = render(
      <MapView
        visible={visibleWith({
          TAXI_STAND: { items: stands, clusters: [] },
          FUEL: { items: [shell], clusters: [] },
          CARPARK: { items: [suntec], clusters: [] },
        })}
      />,
    );
    expect(markers(container)).toHaveLength(4);
  });

  it("labels each marker with its name (shown on hover, read by screen readers)", () => {
    render(
      <MapView
        visible={visibleWith({ TAXI_STAND: { items: stands, clusters: [] }, FUEL: { items: [shell], clusters: [] } })}
      />,
    );
    expect(screen.getByTitle("Orchard Rd along driveway of Lucky Plaza")).toBeInTheDocument();
    expect(screen.getByTitle("Shell Dunearn")).toBeInTheDocument();
  });

  it("colours markers by the mockup's groups: amber for finding passengers, green for rest stops", () => {
    render(
      <MapView
        visible={visibleWith({ TAXI_STAND: { items: stands, clusters: [] }, FUEL: { items: [shell], clusters: [] } })}
      />,
    );
    expect(screen.getByTitle("Mt Elizabeth Rd at Mt Elizabeth Hospital")).toHaveClass("marker-chip--find");
    expect(screen.getByTitle("Shell Dunearn")).toHaveClass("marker-chip--rest");
    expect(screen.getByTitle("Shell Dunearn").querySelector("svg")).not.toBeNull();
  });

  it("draws a cluster as a bubble with its count", () => {
    render(<MapView visible={visibleWith({ CARPARK: { items: [], clusters: [carparkCluster] } })} />);
    const bubble = screen.getByTitle("3 carparks: tap to zoom in");
    expect(bubble).toHaveClass("marker-cluster");
    expect(bubble).toHaveTextContent("3");
    expect(bubble.querySelector("svg")).not.toBeNull(); // the layer's icon: fuel and charging bubbles are both green
  });

  it("removes markers when the items go away", () => {
    const { container, rerender } = render(
      <MapView visible={visibleWith({ TAXI_STAND: { items: stands, clusters: [] } })} />,
    );
    rerender(<MapView visible={visibleWith()} />);
    expect(markers(container)).toHaveLength(0);
  });

  it("doesn't move markers that stayed put when it re-renders (moving one moves its popup, which can loop)", () => {
    const { rerender } = render(<MapView visible={visibleWith({ TAXI_STAND: { items: stands, clusters: [] } })} />);
    const setLatLng = vi.spyOn(Marker.prototype, "setLatLng");

    rerender(<MapView visible={visibleWith({ TAXI_STAND: { items: [...stands], clusters: [] } })} />); // same stands

    expect(setLatLng).not.toHaveBeenCalled();
  });

  it("credits OpenStreetMap only while fuel stations are shown, as its licence requires (D12)", () => {
    const { rerender } = render(<MapView visible={visibleWith()} />);
    expect(screen.queryByRole("link", { name: "OpenStreetMap" })).toBeNull();

    rerender(<MapView visible={visibleWith({ FUEL: { items: [shell], clusters: [] } })} />);
    expect(screen.getByRole("link", { name: "OpenStreetMap" })).toBeInTheDocument();

    rerender(<MapView visible={visibleWith()} />);
    expect(screen.queryByRole("link", { name: "OpenStreetMap" })).toBeNull();
  });
});

describe("MapView.onPan (FR-1.5.3)", () => {
  it("reports what is on screen once laid out: the bounds around the start view, and the zoom", () => {
    withScreenSize();
    const onPan = vi.fn<(v: Viewport) => void>();

    render(<MapView visible={visibleWith()} onPan={onPan} />);

    const { bounds, zoom } = onPan.mock.lastCall![0];
    expect(zoom).toBe(12);
    expect(bounds.south).toBeLessThan(1.3521);
    expect(bounds.north).toBeGreaterThan(1.3521);
    expect(bounds.west).toBeLessThan(103.8198);
    expect(bounds.east).toBeGreaterThan(103.8198);
  });

  it("zooms in where a tapped cluster splits, and reports the new view", () => {
    withScreenSize();
    const onPan = vi.fn<(v: Viewport) => void>();
    render(<MapView visible={visibleWith({ CARPARK: { items: [], clusters: [carparkCluster] } })} onPan={onPan} />);

    fireEvent.click(screen.getByTitle("3 carparks: tap to zoom in"));

    expect(onPan.mock.lastCall![0].zoom).toBe(15);
  });

  it("says nothing while the map has no size yet (the controller keeps its whole-island view)", () => {
    const onPan = vi.fn();
    render(<MapView visible={visibleWith()} onPan={onPan} />);
    expect(onPan).not.toHaveBeenCalled();
  });
});

// Package 2d — live layers: taxis (D24) and hotspot circles (D23).
describe("MapView — live layers (package 2d)", () => {
  const seen = new Date("2026-10-28T13:00:00Z");
  const taxis = [new Taxi(new Location(1.3045, 103.8335), seen), new Taxi(new Location(1.3329, 103.7436), seen)];
  const slot = { validFrom: new Date("2026-10-28T12:40:00Z"), validTo: new Date("2026-10-28T12:50:00Z") };
  const cityHall = new Hotspot({
    id: "city-hall",
    centre: new Location(1.2931, 103.852),
    stationName: "City Hall",
    codes: ["EW13", "NS25"],
    density: "HIGH",
    ...slot,
  });
  const dhoby = new Hotspot({
    id: "dhoby-ghaut",
    centre: new Location(1.2989, 103.8457),
    stationName: "Dhoby Ghaut",
    codes: ["NS24"],
    density: "MEDIUM",
    ...slot,
  });

  it("draws each available taxi as the mockup's amber car marker", () => {
    render(<MapView visible={visibleWith({ TAXIS: { items: taxis, clusters: [] } })} />);
    const markers = screen.getAllByTitle("Available taxi");
    expect(markers).toHaveLength(2);
    expect(markers[0]).toHaveClass("marker-chip--find");
  });

  it("keeps a bubble's title in step with its count as taxis come and go", () => {
    const view = (count: number) => visibleWith({ TAXIS: { items: [], clusters: [{ ...carparkCluster, count }] } });
    const { rerender } = render(<MapView visible={view(12)} />);
    rerender(<MapView visible={view(13)} />);
    expect(screen.getByTitle("13 available taxis: tap to zoom in")).toHaveTextContent("13");
  });

  it("draws a cluster of taxis as a bubble with its count", () => {
    render(<MapView visible={visibleWith({ TAXIS: { items: [], clusters: [{ ...carparkCluster, count: 12 }] } })} />);
    expect(screen.getByTitle("12 available taxis: tap to zoom in")).toHaveTextContent("12");
  });

  it("draws a hotspot as a heat circle with a flame to tap, the circle bigger for a very crowded station", () => {
    const { container } = render(
      <MapView visible={visibleWith({ HOTSPOT: { items: [cityHall, dhoby], clusters: [] } })} />,
    );
    expect(container.querySelectorAll("path.leaflet-interactive")).toHaveLength(2);
    expect(screen.getByTitle("City Hall: very crowded")).toBeInTheDocument();
    expect(screen.getByTitle("Dhoby Ghaut: crowded")).toBeInTheDocument();
    expect(cityHall.radius).toBeGreaterThan(dhoby.radius);
  });

  it("removes the circles when hotspots go away", () => {
    const { container, rerender } = render(
      <MapView visible={visibleWith({ HOTSPOT: { items: [cityHall], clusters: [] } })} />,
    );
    rerender(<MapView visible={visibleWith()} />);
    expect(container.querySelectorAll("path.leaflet-interactive")).toHaveLength(0);
  });
});

// Package 6 — the driver's dot, and moving to a focus (UC 0013, D31).
describe("MapView — the driver (package 6)", () => {
  const driver = (live: boolean) => ({ location: new Location(1.3, 103.8), accuracyM: 40, at: new Date(), live });

  it("draws the driver as the mockup's blue dot, with its accuracy circle", () => {
    const { container } = render(<MapView visible={visibleWith()} driver={driver(true)} />);
    expect(screen.getByTitle("You are here")).toHaveClass("driver-dot");
    expect(container.querySelectorAll("path.leaflet-interactive, path")).not.toHaveLength(0);
  });

  it("says the dot is only the last known position once the GPS stops answering", () => {
    const { rerender } = render(<MapView visible={visibleWith()} driver={driver(true)} />);
    rerender(<MapView visible={visibleWith()} driver={driver(false)} />);
    expect(screen.getByTitle("Your last known position")).toHaveClass("driver-dot--stale");
    expect(screen.queryByTitle("You are here")).not.toBeInTheDocument();
  });

  it("greys the dot when the position isn't live (UC 0013 1a)", () => {
    render(<MapView visible={visibleWith()} driver={driver(false)} />);
    expect(screen.getByTitle("Your last known position")).toHaveClass("driver-dot--stale");
  });

  it("moves to a focus, and back to a place it has been to before when asked again", () => {
    withScreenSize();
    const onPan = vi.fn<(v: Viewport) => void>();
    const here = new Location(1.29, 103.85);
    const there = new Location(1.35, 103.95);
    const centreLatitude = () => {
      const s = onPan.mock.lastCall![0].screen!;
      return (s.south + s.north) / 2;
    };
    const { rerender } = render(
      <MapView visible={visibleWith()} onPan={onPan} focus={{ location: here, zoom: 16, seq: 1 }} />,
    );
    expect(onPan.mock.lastCall![0].zoom).toBe(16);
    expect(centreLatitude()).toBeCloseTo(1.29, 3);

    rerender(<MapView visible={visibleWith()} onPan={onPan} focus={{ location: there, zoom: 16, seq: 2 }} />);
    expect(centreLatitude()).toBeCloseTo(1.35, 3);

    rerender(<MapView visible={visibleWith()} onPan={onPan} focus={{ location: here, zoom: 16, seq: 3 }} />);
    expect(centreLatitude()).toBeCloseTo(1.29, 3);
  });
});

// Package 7 — suggested sites: each one's area, and a numbered pin to tap (D33).
describe("MapView — suggestions (package 7)", () => {
  const asOf = new Date("2026-10-29T13:05:00Z");
  const luckyPlaza = new SuggestedPickup({
    id: "A01",
    name: "Lucky Plaza",
    centre: new Location(1.3043, 103.8338),
    radius: 300,
    score: 0.6,
    summary: "Orchard crowded · no empty taxis nearby",
    asOf,
    taxiCount: 0,
  });
  const mtElizabeth = new SuggestedPickup({
    ...luckyPlaza,
    id: "A05",
    name: "Mt Elizabeth",
    centre: new Location(1.3046, 103.8355),
  });
  const maxwell = new SuggestedRestStop({
    id: "maxwell",
    name: "Maxwell Food Centre",
    centre: new Location(1.28048, 103.84458),
    radius: 500,
    score: 0.7,
    summary: "Food (100 stalls) · parking",
    asOf,
    foodStalls: 100,
    hasParking: true,
    hasFuel: false,
    hasCharging: false,
  });
  const suggestions = {
    PICKUP: [
      { site: luckyPlaza, distanceM: 5 },
      { site: mtElizabeth, distanceM: 196 },
    ],
    REST_STOP: [{ site: maxwell, distanceM: 2907 }],
  };

  it("pins each site with its place in the ranking, amber for pickups and green for rest stops", () => {
    render(<MapView visible={visibleWith()} suggestions={suggestions} />);
    expect(screen.getByTitle("Suggested pickup 1: Lucky Plaza")).toHaveTextContent("1");
    expect(screen.getByTitle("Suggested pickup 2: Mt Elizabeth")).toHaveClass("suggestion-pin--find");
    expect(screen.getByTitle("Suggested rest stop 1: Maxwell Food Centre")).toHaveClass("suggestion-pin--rest");
  });

  it("outlines each site's area in its suggestion's colour", () => {
    const { container } = render(<MapView visible={visibleWith()} suggestions={suggestions} />);
    expect(container.querySelectorAll('path[stroke="#e8930c"]')).toHaveLength(2);
    expect(container.querySelectorAll('path[stroke="#0e7a57"]')).toHaveLength(1);
  });

  it("says why a site was suggested, how far it is and when it was scored, when its pin is tapped", async () => {
    render(<MapView visible={visibleWith()} suggestions={suggestions} />);
    fireEvent.click(screen.getByTitle("Suggested rest stop 1: Maxwell Food Centre"));
    expect(await screen.findByText("Food (100 stalls) · parking")).toBeInTheDocument();
    expect(screen.getByText("2.9 km away · as of 21:05")).toBeInTheDocument();
  });

  it("keeps each pin's title in step with its place when the ranking changes (react-leaflet sets it only once)", () => {
    const { rerender } = render(<MapView visible={visibleWith()} suggestions={suggestions} />);
    rerender(
      <MapView visible={visibleWith()} suggestions={{ ...suggestions, PICKUP: [...suggestions.PICKUP].reverse() }} />,
    );
    expect(screen.getByTitle("Suggested pickup 1: Mt Elizabeth")).toHaveTextContent("1");
    expect(screen.getByTitle("Suggested pickup 2: Lucky Plaza")).toHaveTextContent("2");
  });

  it("draws nothing for suggestions that are off", () => {
    const { container } = render(<MapView visible={visibleWith()} />);
    expect(container.querySelectorAll(".suggestion-pin")).toHaveLength(0);
    expect(container.querySelectorAll(".leaflet-overlay-pane path")).toHaveLength(0);
  });
});

// Package 8 — popups with a star and Navigate (D39), and a chosen bookmark highlighted (UC 0011).
describe("MapView — bookmarks and navigation (package 8)", () => {
  const actions = (): PlaceActions => ({
    bookmarked: new Set(["CARPARK:1"]),
    onToggleBookmark: vi.fn(),
    onNavigate: vi.fn(),
  });

  it("gives a landmark's popup its star and Navigate when it has actions", async () => {
    render(<MapView visible={visibleWith({ CARPARK: { items: [suntec], clusters: [] } })} actions={actions()} />);
    fireEvent.click(screen.getByTitle("Suntec City"));
    expect(await screen.findByRole("button", { name: "Remove the bookmark for Suntec City" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Navigate" })).toBeInTheDocument();
  });

  it("shows a highlighted landmark ringed, with its details open, even with its layer off", async () => {
    const { container } = render(<MapView visible={visibleWith()} highlighted={suntec} actions={actions()} />);
    expect(screen.getByTitle("Suntec City, from your bookmarks")).toHaveClass("marker-chip--highlighted");
    expect(await screen.findByRole("heading", { name: "Suntec City" })).toBeInTheDocument();
    expect(container.querySelectorAll(".leaflet-popup")).toHaveLength(1);
  });

  it("says when the highlighted landmark's details are closed", async () => {
    const onHighlightClosed = vi.fn();
    render(<MapView visible={visibleWith()} highlighted={suntec} onHighlightClosed={onHighlightClosed} />);
    await screen.findByRole("heading", { name: "Suntec City" });
    fireEvent.click(document.querySelector(".leaflet-popup-close-button")!);
    expect(onHighlightClosed).toHaveBeenCalledWith(suntec);
  });
});

// Package 9a — dark mode's Night map (D44).
describe("MapView — dark mode (package 9a)", () => {
  const tileUrls = (container: HTMLElement) =>
    [...container.querySelectorAll("img.leaflet-tile")].map((img) => img.getAttribute("src") ?? "");

  it("draws OneMap's Default map, or its Night map in dark mode, and switches without a reload", () => {
    withScreenSize();
    const { container, rerender } = render(<MapView visible={visibleWith()} />);
    expect(tileUrls(container).length).toBeGreaterThan(0);
    expect(tileUrls(container).every((u) => u.includes("/maps/tiles/Default/"))).toBe(true);

    rerender(<MapView visible={visibleWith()} dark />);

    expect(tileUrls(container).length).toBeGreaterThan(0);
    expect(tileUrls(container).every((u) => u.includes("/maps/tiles/Night/"))).toBe(true);
  });
});
