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
import { TaxiStand } from "../entity/TaxiStand";
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
