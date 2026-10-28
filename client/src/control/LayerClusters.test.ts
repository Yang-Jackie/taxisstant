// Package 2b tests — LayerClusters: nearby markers merge into counted bubbles while zoomed out (D17, FR-1.5.3).
import { describe, expect, it } from "vitest";
import type { Viewport } from "../entity/Bounds";
import type { Locatable } from "../entity/Locatable";
import { Location } from "../entity/Location";
import { LAST_CLUSTERED_ZOOM, LayerClusters } from "./LayerClusters";

const at = (latitude: number, longitude: number, name: string) => {
  const location = new Location(latitude, longitude);
  return { name, getLocation: () => location } satisfies Locatable & { name: string };
};
// Three points in Orchard, 100–400 m apart, and one in Jurong, about 15 km away
const orchard = [at(1.3043, 103.8338, "A"), at(1.3046, 103.8355, "B"), at(1.3035, 103.8377, "C")];
const jurong = at(1.3329, 103.7436, "D");
const island = { south: 1.144, west: 103.535, north: 1.494, east: 104.15 };
const view = (zoom: number, bounds = island): Viewport => ({ bounds, zoom });

describe("LayerClusters", () => {
  const clusters = new LayerClusters([...orchard, jurong]);

  it("merges nearby markers into one bubble with a count when zoomed out", () => {
    const { items, clusters: bubbles } = clusters.view(view(12));
    expect(bubbles).toHaveLength(1);
    expect(bubbles[0]!.count).toBe(3);
    expect(items.map((i) => i.name)).toEqual(["D"]); // Jurong is far from the others: it stays a single marker
  });

  it("never loses a marker: singles plus bubble counts add up to everything in view", () => {
    for (const zoom of [11, 12, 13, 14, 15, 16, 17, 18]) {
      const { items, clusters: bubbles } = clusters.view(view(zoom));
      expect(items.length + bubbles.reduce((n, b) => n + b.count, 0), `zoom ${zoom}`).toBe(4);
    }
  });

  it("shows every marker on its own from zoom 17 (street level), even ones a few metres apart", () => {
    const twins = new LayerClusters([at(1.3, 103.8, "E"), at(1.30005, 103.8, "F")]); // about 6 m apart
    expect(twins.view(view(16)).clusters).toHaveLength(1);
    expect(twins.view(view(17)).items).toHaveLength(2);
    expect(LAST_CLUSTERED_ZOOM).toBe(16);
  });

  it("puts a bubble among its markers, and says which zoom splits it", () => {
    const [bubble] = clusters.view(view(12)).clusters;
    expect(bubble!.location.distanceTo(orchard[1]!.getLocation())).toBeLessThan(500);
    expect(bubble!.zoomTo).toBeGreaterThan(12);
    const split = clusters.view(view(bubble!.zoomTo));
    expect(split.clusters.every((b) => b.count < 3)).toBe(true);
  });

  it("keeps only what is in view", () => {
    const aroundJurong = { south: 1.32, west: 103.73, north: 1.34, east: 103.76 };
    expect(clusters.view(view(18, aroundJurong)).items.map((i) => i.name)).toEqual(["D"]);
  });

  it("returns the very objects it was given, so the map gets real entities", () => {
    expect(clusters.view(view(18)).items).toContain(jurong);
  });

  it("works with nothing in it", () => {
    expect(new LayerClusters([]).view(view(12))).toEqual({ items: [], clusters: [] });
  });
});
