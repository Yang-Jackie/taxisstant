// M4 acceptance tests — FilterTool «boundary»: the row of layer toggles (the mockup's bottom sheet).
// It only *shows* which layers are on and *reports* clicks; whoever renders it owns the state.
// Package 10a: the mockup's sheet: icon chips that expand to labelled tiles (the dialog map's Filter bar and menu).
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { LayerType } from "../entity/LayerType";
import { FilterTool } from "./FilterTool";
import { i18next } from "./i18n";

/** The layer toggles: every button but the sheet's handle. */
const toggles = () => screen.getAllByRole("button").filter((b) => b.hasAttribute("aria-pressed"));

/** The labels from the team's mockup, one per LayerType. */
const LABELS = ["Taxi stands", "Nearby taxis", "Hotspots", "Carpark", "Fuel", "Charge", "Hawker food"];

describe("FilterTool", () => {
  it("shows one toggle button per map layer, labelled as in the mockup", () => {
    render(<FilterTool active={new Set()} onToggle={() => {}} />);
    for (const label of LABELS) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
    expect(toggles()).toHaveLength(7);
  });

  it("marks the layers that are on as pressed, and the rest as not pressed", () => {
    render(<FilterTool active={new Set<LayerType>(["TAXI_STAND", "FUEL"])} onToggle={() => {}} />);
    expect(screen.getByRole("button", { name: "Taxi stands" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Fuel" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Hotspots" })).toHaveAttribute("aria-pressed", "false");
  });

  it("reports which layer was clicked", async () => {
    const onToggle = vi.fn();
    render(<FilterTool active={new Set()} onToggle={onToggle} />);

    await userEvent.click(screen.getByRole("button", { name: "Taxi stands" }));

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith("TAXI_STAND");
  });

  it("doesn't change by itself — it shows exactly what it's given (a controlled component)", async () => {
    render(<FilterTool active={new Set()} onToggle={() => {}} />);
    const button = screen.getByRole("button", { name: "Taxi stands" });

    await userEvent.click(button);

    expect(button).toHaveAttribute("aria-pressed", "false"); // the parent didn't turn it on, so it stays off
  });

  it("shows only the layers it is given: a vehicle type hides the other energy layer (D43)", () => {
    render(<FilterTool active={new Set()} onToggle={() => {}} layers={["TAXI_STAND", "FUEL"]} />);
    expect(toggles().map((b) => b.getAttribute("aria-label"))).toEqual(["Taxi stands", "Fuel"]);
  });
});

describe("FilterTool — the mockup's bottom sheet (package 10a)", () => {
  it("starts collapsed: icon-only chips, named for screen readers, in the mockup's order and colours", () => {
    render(<FilterTool active={new Set()} onToggle={() => {}} />);
    expect(screen.getByRole("button", { name: "Show the layers' names" })).toHaveAttribute("aria-expanded", "false");
    expect(toggles().map((b) => b.getAttribute("aria-label"))).toEqual([
      "Hotspots",
      "Taxi stands",
      "Nearby taxis",
      "Fuel",
      "Charge",
      "Carpark",
      "Hawker food",
    ]);
    expect(toggles().every((b) => b.textContent?.trim() === "")).toBe(true); // icons only
    expect(toggles().map((b) => b.className.match(/--(find|rest)/)?.[1])).toEqual([
      "find",
      "find",
      "find",
      "rest",
      "rest",
      "rest",
      "rest",
    ]);
  });

  it("toggles a layer from a chip without expanding (the mockup's note)", async () => {
    const onToggle = vi.fn();
    render(<FilterTool active={new Set()} onToggle={onToggle} />);
    await userEvent.click(screen.getByRole("button", { name: "Hotspots" }));
    expect(onToggle).toHaveBeenCalledExactlyOnceWith("HOTSPOT");
    expect(screen.getByRole("button", { name: "Show the layers' names" })).toHaveAttribute("aria-expanded", "false");
  });

  it("expands with its handle to labelled tiles (the dialog map's Filter menu), which toggle too, and collapses", async () => {
    const onToggle = vi.fn();
    render(<FilterTool active={new Set<LayerType>(["FUEL"])} onToggle={onToggle} />);

    await userEvent.click(screen.getByRole("button", { name: "Show the layers' names" }));

    expect(screen.getByRole("button", { name: "Show icons only" })).toHaveAttribute("aria-expanded", "true");
    expect(toggles().map((b) => b.textContent?.trim())).toEqual([
      "Hotspots",
      "Taxi stands",
      "Nearby taxis",
      "Fuel",
      "Charge",
      "Carpark",
      "Hawker food",
    ]);
    expect(screen.getByRole("button", { name: "Fuel" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "Carpark" }));
    expect(onToggle).toHaveBeenCalledExactlyOnceWith("CARPARK");

    await userEvent.click(screen.getByRole("button", { name: "Show icons only" }));
    expect(toggles()[0]).toHaveAttribute("aria-label", "Hotspots");
  });

  it("shows a fade with a chevron while more chips are off to the right, and not at the end", () => {
    const sizes = { clientWidth: 300, scrollWidth: 420 };
    for (const [prop, value] of Object.entries(sizes)) {
      vi.spyOn(HTMLElement.prototype, prop as "clientWidth", "get").mockReturnValue(value);
    }
    const { container } = render(<FilterTool active={new Set()} onToggle={() => {}} />);
    expect(container.querySelector(".filter-tool__fade")).not.toBeNull();

    const row = container.querySelector<HTMLElement>(".filter-tool__peek")!;
    row.scrollLeft = 120;
    fireEvent.scroll(row);

    expect(container.querySelector(".filter-tool__fade")).toBeNull();
    vi.restoreAllMocks();
  });

  it("names its handle in Chinese", async () => {
    await act(() => i18next.changeLanguage("zh"));
    render(<FilterTool active={new Set()} onToggle={() => {}} />);
    expect(screen.getByRole("button", { name: "显示图层名称" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "德士站" })).toBeInTheDocument();
  });
});

describe("FilterTool — loading (NF-3)", () => {
  it("marks the chip of a layer whose data is on its way as busy, and its tile once expanded", async () => {
    render(
      <FilterTool active={new Set<LayerType>(["FUEL"])} onToggle={() => {}} loading={new Set<LayerType>(["FUEL"])} />,
    );
    expect(screen.getByRole("button", { name: "Fuel" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Hotspots" })).toHaveAttribute("aria-busy", "false");

    await userEvent.click(screen.getByRole("button", { name: "Show the layers' names" }));

    expect(screen.getByRole("button", { name: "Fuel" })).toHaveAttribute("aria-busy", "true");
  });
});
