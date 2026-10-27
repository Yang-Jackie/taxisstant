// M4 regression test — leafletSetup: markers must use the image URLs Vite gives us, exactly.
// jsdom has no leaflet.css, so we add the one rule Leaflet reads to guess its image folder.
import L from "leaflet";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import { afterEach, describe, expect, it } from "vitest";
import "./leafletSetup";

describe("leafletSetup", () => {
  afterEach(() => {
    document.head.querySelector("#leaflet-css")?.remove();
  });

  it("gives markers our icon URL, without Leaflet's guessed folder in front", () => {
    const style = document.createElement("style");
    style.id = "leaflet-css";
    style.textContent = ".leaflet-default-icon-path { background-image: url(/somewhere/images/marker-icon.png); }";
    document.head.append(style);

    const img = new L.Icon.Default().createIcon() as HTMLImageElement;

    expect(img.getAttribute("src")).toBe(iconUrl);
  });
});
