// Package 9c acceptance tests — HelpView «boundary»: the dialog map's Help and support page (D46).
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { HelpView } from "./HelpView";
import { i18next } from "./i18n";

const now = new Date("2026-10-28T20:00:00Z"); // 4 am on 29 Oct in Singapore, still 28 Oct in UTC

function renderHelp() {
  const handlers = { onBack: vi.fn(), onClose: vi.fn() };
  render(<HelpView {...handlers} now={now} />);
  return handlers;
}

describe("HelpView", () => {
  it("is a dialog that explains each feature under its own heading", () => {
    renderHelp();
    expect(screen.getByRole("dialog", { name: "Help & support" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Map layers",
      "Smart suggestions",
      "Directions",
      "Bookmarks",
      "Your location",
      "Settings",
      "How up to date",
      "Data sources",
      "About",
    ]);
    expect(screen.getByText(/Your location stays on your phone/)).toBeInTheDocument(); // D32
  });

  it("credits each open-data source with the Singapore Open Data Licence's own statement, linked, and when", () => {
    renderHelp();
    const credits = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(credits).toContain(
      "Contains information from Taxi Stands, Carpark Availability, EV Charging Points and Platform Crowd Density " +
        "Real Time accessed on 29 Oct 2026 from LTA DataMall which is made available under the terms of the Singapore " +
        "Open Data Licence version 1.0.",
    );
    expect(credits).toContain(
      "Contains information from Taxi Availability, Dates of Hawker Centres Closure and LTA MRT Station Exit accessed " +
        "on 29 Oct 2026 from data.gov.sg which is made available under the terms of the Singapore Open Data Licence " +
        "version 1.0.",
    );
    for (const link of screen.getAllByRole("link", { name: "Singapore Open Data Licence version 1.0" })) {
      expect(link).toHaveAttribute("href", "https://data.gov.sg/open-data-licence");
      expect(link).toHaveAttribute("target", "_blank");
    }
  });

  it("credits OpenStreetMap for the fuel stations and OneMap for the map", () => {
    renderHelp();
    expect(screen.getByRole("link", { name: "OpenStreetMap contributors" })).toHaveAttribute(
      "href",
      "https://www.openstreetmap.org/copyright",
    );
    expect(screen.getByRole("link", { name: "OneMap" })).toHaveAttribute("href", "https://www.onemap.gov.sg/");
  });

  it("says it is a student project that no agency endorses, as the licence asks, and names no one", () => {
    renderHelp();
    expect(
      screen.getByText(
        "TaxiMate is a student project for SC2006 Software Engineering. It is not an official app, and no government agency endorses it.",
      ),
    ).toBeInTheDocument();
  });

  it("speaks Chinese, keeping the licences' statements in English and marked as English", async () => {
    await act(() => i18next.changeLanguage("zh"));
    renderHelp();
    expect(screen.getByRole("dialog", { name: "帮助与支持" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "数据来源" })).toBeInTheDocument();
    const sources = screen.getAllByRole("list")[0]!;
    expect(sources).toHaveAttribute("lang", "en");
    expect(within(sources).getAllByRole("listitem")[0]).toHaveTextContent(/^Contains information from Taxi Stands/);
  });

  it("goes back to the menu, or closes", async () => {
    const { onBack, onClose } = renderHelp();
    expect(screen.getByRole("button", { name: "Back to the menu" })).toHaveFocus();
    await userEvent.click(screen.getByRole("button", { name: "Back to the menu" }));
    await userEvent.click(screen.getByRole("button", { name: "Close the menu" }));
    expect(onBack).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
