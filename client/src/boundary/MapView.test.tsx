// M4 acceptance tests — MapView «boundary»: the full-screen OneMap map with one marker per taxi stand.
// jsdom has no real screen, so map tiles never load in tests — but markers and the credit line do.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Location } from "../entity/Location";
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

function markers(container: HTMLElement) {
  return container.querySelectorAll(".leaflet-marker-icon");
}

describe("MapView", () => {
  it("draws a Leaflet map", () => {
    const { container } = render(<MapView taxiStands={[]} />);
    expect(container.querySelector(".leaflet-container")).not.toBeNull();
  });

  it("credits OneMap and the Singapore Land Authority, as OneMap's terms require", () => {
    render(<MapView taxiStands={[]} />);
    expect(screen.getByRole("link", { name: "OneMap" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Singapore Land Authority" })).toBeInTheDocument();
  });

  it("shows no markers when there are no stands", () => {
    const { container } = render(<MapView taxiStands={[]} />);
    expect(markers(container)).toHaveLength(0);
  });

  it("shows one marker per taxi stand", () => {
    const { container } = render(<MapView taxiStands={stands} />);
    expect(markers(container)).toHaveLength(2);
  });

  it("labels each marker with the stand's name (shown on hover, read by screen readers)", () => {
    render(<MapView taxiStands={stands} />);
    expect(screen.getByTitle("Orchard Rd along driveway of Lucky Plaza")).toBeInTheDocument();
    expect(screen.getByTitle("Mt Elizabeth Rd at Mt Elizabeth Hospital")).toBeInTheDocument();
  });

  it("removes markers when the stands go away", () => {
    const { container, rerender } = render(<MapView taxiStands={stands} />);
    rerender(<MapView taxiStands={[]} />);
    expect(markers(container)).toHaveLength(0);
  });
});
