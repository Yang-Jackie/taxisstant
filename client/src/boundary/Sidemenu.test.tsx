// Package 7 acceptance tests — Sidemenu «boundary» (the mockup's drawer) and RecommendationCard: a toggle per smart
// suggestion, and while it is on, its best sites to choose from (D33).
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RecommendationState } from "../control/RecommendationController";
import { Location } from "../entity/Location";
import type { RecommendationKind } from "../entity/RecommendationKind";
import { SuggestedPickup } from "../entity/SuggestedPickup";
import { Sidemenu, type SidemenuProps } from "./Sidemenu";

const asOf = new Date("2026-10-29T13:05:00Z"); // 21:05 in Singapore
/** A pickup at a crowded Orchard with `taxis` empty taxis nearby: its summary is built from these facts. */
const pickup = (id: string, name: string, taxis: number, centre: Location) =>
  new SuggestedPickup({
    id,
    name,
    centre,
    radius: 300,
    score: 0.5,
    summary: "(the server's English summary, which the app no longer shows)",
    asOf,
    taxiCount: taxis,
    crowdDensity: "MEDIUM",
    stationName: "Orchard",
  });
const mtElizabeth = pickup("A05", "Mt Elizabeth Hospital", 1, new Location(1.304571786, 103.835547));
const luckyPlaza = pickup("A01", "Lucky Plaza", 3, new Location(1.304294727, 103.8338467));

const none: RecommendationState = { results: { PICKUP: [], REST_STOP: [] }, noResults: {}, pending: new Set() };
const pickupsOn: RecommendationState = {
  ...none,
  results: {
    PICKUP: [
      { site: mtElizabeth, distanceM: 196 },
      { site: luckyPlaza, distanceM: 1240 },
    ],
    REST_STOP: [],
  },
};

function renderMenu(props: Partial<SidemenuProps> = {}) {
  const handlers = {
    onToggleSuggestion: vi.fn(),
    onSelect: vi.fn(),
    onSelectBookmark: vi.fn(),
    onOpenLanguage: vi.fn(),
    onOpenSettings: vi.fn(),
    onOpenHelp: vi.fn(),
    onClose: vi.fn(),
  };
  render(<Sidemenu active={new Set()} recommendations={none} {...handlers} {...props} />);
  return handlers;
}
const toggle = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name}`) });

describe("Sidemenu", () => {
  it("is a dialog with the mockup's brand and two smart suggestions, both off at first", () => {
    renderMenu();
    expect(screen.getByRole("dialog", { name: "Menu" })).toBeInTheDocument();
    expect(screen.getByText("TaxiMate")).toBeInTheDocument();
    expect(screen.getByText("Smart suggestions")).toBeInTheDocument();
    expect(toggle("Suggested pickup")).toHaveAttribute("aria-pressed", "false");
    expect(toggle("Suggested pickup")).toHaveTextContent("Best place to find a fare now");
    expect(toggle("Suggested rest stop")).toHaveAttribute("aria-pressed", "false");
    expect(toggle("Suggested rest stop")).toHaveTextContent("Parking, food & fuel nearby");
  });

  it("tells the controller which suggestion was tapped (onToggleSuggestion)", async () => {
    const { onToggleSuggestion } = renderMenu();
    await userEvent.click(toggle("Suggested rest stop"));
    expect(onToggleSuggestion).toHaveBeenCalledExactlyOnceWith("REST_STOP");
  });

  it("shows a suggestion as on, with its best sites below it, nearest-weighted best first (RecommendationCard)", () => {
    renderMenu({ active: new Set<RecommendationKind>(["PICKUP"]), recommendations: pickupsOn });

    expect(toggle("Suggested pickup")).toHaveAttribute("aria-pressed", "true");
    const sites = screen.getAllByRole("listitem");
    expect(sites.map((li) => li.textContent)).toEqual([
      "1Mt Elizabeth HospitalOrchard crowded · 1 empty taxi nearby200 m",
      "2Lucky PlazaOrchard crowded · 3 empty taxis nearby1.2 km",
    ]);
    expect(screen.getByText("Scored at 21:05")).toBeInTheDocument();
  });

  it("shows the map a site that is tapped (the dialog map's 'show on the map')", async () => {
    const { onSelect } = renderMenu({ active: new Set<RecommendationKind>(["PICKUP"]), recommendations: pickupsOn });
    await userEvent.click(screen.getByRole("button", { name: /Lucky Plaza/ }));
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(luckyPlaza);
  });

  it("shows nothing below a suggestion that is off", () => {
    renderMenu({ recommendations: pickupsOn });
    expect(screen.queryByRole("listitem")).toBeNull();
  });

  it("says it is finding sites while a suggestion loads", () => {
    renderMenu({ recommendations: { ...none, pending: new Set<RecommendationKind>(["REST_STOP"]) } });
    expect(toggle("Suggested rest stop")).toHaveAttribute("aria-busy", "true");
    expect(toggle("Suggested rest stop")).toHaveTextContent("Finding the best nearby…");
  });

  const empty: [RecommendationKind, RecommendationState["noResults"], string][] = [
    ["PICKUP", { PICKUP: "NO_POSITION" }, "Waiting for your location…"],
    ["PICKUP", { PICKUP: "OUT_OF_DATE" }, "These suggestions are out of date. Please check your connection."],
    ["PICKUP", { PICKUP: "NONE_NEARBY" }, "No ideal pickup spots within 3 km right now."],
    ["REST_STOP", { REST_STOP: "NONE_NEARBY" }, "No ideal rest stops within 5 km right now."],
  ];
  for (const [k, noResults, text] of empty) {
    it(`says why ${k} has nothing to suggest: "${text}"`, () => {
      renderMenu({ active: new Set([k]), recommendations: { ...none, noResults } });
      expect(screen.getByText(text)).toBeInTheDocument();
    });
  }

  it("closes with its close button, a tap outside it, or Escape", async () => {
    const { onClose } = renderMenu();
    await userEvent.click(screen.getByRole("button", { name: "Close the menu" }));
    fireEvent.click(document.querySelector(".drawer__overlay")!);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("puts the focus on its close button when it opens, for keyboards and screen readers", () => {
    renderMenu();
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Close the menu" })).toHaveFocus();
  });

  it("lists the bookmarks under them (D40), and shows the map one that is chosen", async () => {
    const onSelectBookmark = vi.fn();
    const suntec = {
      id: "CARPARK:1",
      layer: "CARPARK" as const,
      landmarkId: "1",
      label: "Suntec City",
      location: new Location(1.29375, 103.85718),
      dateSaved: asOf,
    };
    renderMenu({ bookmarks: [suntec], onSelectBookmark });
    expect(screen.getByRole("heading", { name: "Bookmarks" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Suntec City/ }));
    expect(onSelectBookmark).toHaveBeenCalledExactlyOnceWith(suntec);
  });

  it("offers Navigate beside each suggested site (RecommendationCard.onNavigate, D39)", async () => {
    const onNavigate = vi.fn();
    renderMenu({ active: new Set<RecommendationKind>(["PICKUP"]), recommendations: pickupsOn, onNavigate });
    await userEvent.click(screen.getByRole("button", { name: "Navigate to Lucky Plaza" }));
    expect(onNavigate).toHaveBeenCalledExactlyOnceWith({ location: luckyPlaza.centre, name: "Lucky Plaza" });
  });

  it("opens Settings from its entry under a divider (the dialog map's 'Settings button pressed')", async () => {
    const onOpenSettings = vi.fn();
    renderMenu({ onOpenSettings });
    await userEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(onOpenSettings).toHaveBeenCalledOnce();
  });

  it("opens the language choice from its Language entry (the dialog map's 'Language selection button pressed')", async () => {
    const onOpenLanguage = vi.fn();
    renderMenu({ onOpenLanguage });
    await userEvent.click(screen.getByRole("button", { name: "Language" }));
    expect(onOpenLanguage).toHaveBeenCalledOnce();
  });

  it("opens Help & support from its entry, last as in the mockup", async () => {
    const onOpenHelp = vi.fn();
    renderMenu({ onOpenHelp });
    const entries = screen
      .getAllByRole("button")
      .slice(-3)
      .map((b) => b.textContent?.trim()); // the icons' SVG text is whitespace
    expect(entries).toEqual(["Language", "Settings", "Help & support"]);
    await userEvent.click(screen.getByRole("button", { name: "Help & support" }));
    expect(onOpenHelp).toHaveBeenCalledOnce();
  });
});
