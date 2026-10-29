// Package 2b tests — LandmarkDetails: what a marker's popup says, per layer.
// Package 8: its star (UC 0011) and Navigate (UC 0012), and Navigate in hotspot and suggestion popups (D39).
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Carpark } from "../entity/Carpark";
import { ChargingStation } from "../entity/ChargingStation";
import { FuelStation } from "../entity/FuelStation";
import { HawkerCentre } from "../entity/HawkerCentre";
import { Hotspot } from "../entity/Hotspot";
import { Location } from "../entity/Location";
import { TaxiStand } from "../entity/TaxiStand";
import { SuggestedPickup } from "../entity/SuggestedPickup";
import { HotspotDetails, LandmarkDetails, SuggestionDetails, type PlaceActions } from "./LandmarkDetails";

const at = (address?: string) => new Location(1.3, 103.8, address);
const text = () => screen.getByRole("heading").closest(".landmark-details")!.textContent;

describe("LandmarkDetails", () => {
  it("names the landmark in a heading", () => {
    render(<LandmarkDetails item={new Carpark({ id: "1", name: "Suntec City", location: at(), agency: "LTA" })} />);
    expect(screen.getByRole("heading", { name: "Suntec City" })).toBeInTheDocument();
  });

  it("taxi stand: stand or stop, and barrier-free access", () => {
    render(
      <LandmarkDetails
        item={
          new TaxiStand({ id: "A06", name: "Cairnhill Nine", location: at(), standType: "Stop", isBarrierFree: true })
        }
      />,
    );
    expect(text()).toContain("Taxi stop");
    expect(text()).toContain("Barrier-free access");
  });

  it("carpark: who runs it, and LTA's area", () => {
    render(
      <LandmarkDetails
        item={new Carpark({ id: "1", name: "Suntec City", location: at(), agency: "LTA", area: "Marina" })}
      />,
    );
    expect(text()).toContain("LTA carpark · Marina");
  });

  it("fuel station: brand (unless the name says it), address and opening hours", () => {
    const station = new FuelStation({
      id: "way/1",
      name: "Upper Bukit Timah",
      brand: "Shell",
      location: at("772 Upper Bukit Timah Road"),
      openingHours: "24/7",
    });
    render(<LandmarkDetails item={station} />);
    expect(text()).toContain("Shell");
    expect(text()).toContain("772 Upper Bukit Timah Road");
    expect(text()).toContain("Open 24/7");
  });

  it("charging station: how many chargers, how fast, which plugs, who runs them", () => {
    const station = new ChargingStation({
      id: "x",
      name: "CLARKE QUAY",
      location: at("3E RIVER VALLEY ROAD"),
      operators: ["SP MOBILITY PTE. LTD."],
      chargePoints: 3,
      maxPowerKw: 50,
      hasDcFast: true,
      plugTypes: ["Combo 2", "Type 2"],
    });
    render(<LandmarkDetails item={station} />);
    expect(text()).toContain("3 chargers · up to 50 kW · DC fast");
    expect(text()).toContain("Combo 2, Type 2");
    expect(text()).toContain("SP MOBILITY PTE. LTD.");
  });

  const adam = new HawkerCentre({
    id: "adam-road-food-centre",
    name: "Adam Road Food Centre",
    location: at("2, Adam Road, Singapore 289876"),
    foodStalls: 32,
    marketStalls: 0,
    closures: [
      { from: "2026-12-07", to: "2026-12-08", reason: "cleaning" },
      { from: "2026-06-08", to: "2026-08-07", reason: "works", remarks: "Repairs and Redecoration" },
    ],
  });

  it("hawker centre: address, stalls, and the next closure (D13)", () => {
    render(<LandmarkDetails item={adam} now={new Date("2026-10-28T12:00:00+08:00")} />);
    expect(text()).toContain("32 food stalls");
    expect(text()).toContain("Next closed 7 Dec – 8 Dec for cleaning");
  });

  it("hawker centre: warns when it is closed today, and says why and until when", () => {
    render(<LandmarkDetails item={adam} now={new Date("2026-07-01T12:00:00+08:00")} />);
    expect(text()).toContain("Closed today for repairs and redecoration, until 7 Aug");
  });
});

// Package 2d — live figures in popups, with how old they are (D22).
describe("LandmarkDetails — live availability (package 2d)", () => {
  const asOf = new Date("2026-10-28T12:50:00Z"); // 20:50 in Singapore
  const now = new Date("2026-10-28T13:00:00Z");

  it("carpark: free lots, and as of when", () => {
    const carpark = new Carpark({ id: "1", name: "Suntec City", location: at(), agency: "LTA" }).withAvailability(
      117,
      asOf,
    );
    render(<LandmarkDetails item={carpark} now={now} />);
    expect(text()).toContain("117 lots free · as of 20:50");
  });

  it("charging station: free chargers out of all of them, and as of when", () => {
    const station = new ChargingStation({
      id: "x",
      name: "CLARKE QUAY",
      location: at("3E RIVER VALLEY ROAD"),
      operators: ["SP"],
      chargePoints: 3,
      hasDcFast: true,
      plugTypes: ["Combo 2"],
    }).withAvailability(2, asOf);
    render(<LandmarkDetails item={station} now={now} />);
    expect(text()).toContain("2 of 3 free · as of 20:50");
  });

  it("says nothing about free lots once the figure is too old to trust", () => {
    const carpark = new Carpark({ id: "1", name: "Suntec City", location: at(), agency: "LTA" }).withAvailability(
      117,
      asOf,
    );
    render(<LandmarkDetails item={carpark} now={new Date("2026-10-28T13:30:00Z")} />);
    expect(text()).not.toContain("lots free");
  });
});

describe("HotspotDetails (package 2d)", () => {
  it("says how crowded the platforms were, and as of when (the slot's end, D20)", () => {
    const hotspot = new Hotspot({
      id: "city-hall",
      centre: new Location(1.2931, 103.852),
      stationName: "City Hall",
      codes: ["EW13", "NS25"],
      density: "HIGH",
      validFrom: new Date("2026-10-28T12:40:00Z"),
      validTo: new Date("2026-10-28T12:50:00Z"),
    });
    render(<HotspotDetails hotspot={hotspot} />);
    expect(screen.getByRole("heading", { name: "City Hall" })).toBeInTheDocument();
    expect(text()).toContain("Very crowded platforms · as of 20:50");
    expect(text()).toContain("EW13 · NS25");
  });
});

describe("LandmarkDetails — star and Navigate (package 8, D39)", () => {
  const suntec = new Carpark({ id: "1", name: "Suntec City", location: at(), agency: "LTA" });
  const actionsWith = (bookmarked: string[] = []): PlaceActions => ({
    bookmarked: new Set(bookmarked),
    onToggleBookmark: vi.fn(),
    onNavigate: vi.fn(),
  });

  it("has an unlit star that bookmarks the landmark (UC 0011)", async () => {
    const actions = actionsWith();
    render(<LandmarkDetails item={suntec} actions={actions} />);
    const star = screen.getByRole("button", { name: "Bookmark Suntec City" });
    expect(star).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(star);
    expect(actions.onToggleBookmark).toHaveBeenCalledExactlyOnceWith(suntec);
  });

  it("has a lit star once bookmarked, which takes the bookmark away", () => {
    render(<LandmarkDetails item={suntec} actions={actionsWith(["CARPARK:1"])} />);
    expect(screen.getByRole("button", { name: "Remove the bookmark for Suntec City" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("lights the star without replacing its icon, so the map doesn't take the tap for a tap on the map", () => {
    // In a browser React redraws the popup while the tap is still on its way up to the map, and Leaflet closes the
    // popup for a tap whose target is no longer in the page (jsdom dispatches too synchronously to show this)
    const { rerender } = render(<LandmarkDetails item={suntec} actions={actionsWith()} />);
    const icons = [...screen.getByRole("button", { name: "Bookmark Suntec City" }).querySelectorAll("svg")];

    rerender(<LandmarkDetails item={suntec} actions={actionsWith(["CARPARK:1"])} />);

    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) expect(icon.isConnected).toBe(true);
  });

  it("has Navigate, which asks to route to the landmark by name (UC 0012)", async () => {
    const actions = actionsWith();
    render(<LandmarkDetails item={suntec} actions={actions} />);
    await userEvent.click(screen.getByRole("button", { name: "Navigate" }));
    expect(actions.onNavigate).toHaveBeenCalledExactlyOnceWith({ location: suntec.location, name: "Suntec City" });
  });

  it("gives facts only, with no buttons, when there are no actions", () => {
    render(<LandmarkDetails item={suntec} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("offers Navigate to a busy station and to a suggested site too", async () => {
    const onNavigate = vi.fn();
    const slot = { validFrom: new Date("2026-10-28T12:40:00Z"), validTo: new Date("2026-10-28T12:50:00Z") };
    const cityHall = new Hotspot({
      id: "city-hall",
      centre: at(),
      stationName: "City Hall",
      codes: [],
      density: "HIGH",
      ...slot,
    });
    const site = new SuggestedPickup({
      id: "A01",
      name: "Lucky Plaza",
      centre: at(),
      radius: 300,
      score: 0.5,
      summary: "",
      asOf: slot.validTo,
      taxiCount: 0,
    });
    render(<HotspotDetails hotspot={cityHall} onNavigate={onNavigate} />);
    render(<SuggestionDetails recommendation={{ site, distanceM: 100 }} onNavigate={onNavigate} />);
    for (const button of screen.getAllByRole("button", { name: "Navigate" })) await userEvent.click(button);
    expect(onNavigate.mock.calls.map(([t]) => t.name)).toEqual(["City Hall", "Lucky Plaza"]);
  });
});
