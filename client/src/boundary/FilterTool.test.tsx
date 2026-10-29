// M4 acceptance tests — FilterTool «boundary»: the row of layer toggles (the mockup's bottom sheet).
// It only *shows* which layers are on and *reports* clicks; whoever renders it owns the state.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { LayerType } from "../entity/LayerType";
import { FilterTool } from "./FilterTool";

/** The labels from the team's mockup, one per LayerType. */
const LABELS = ["Taxi stands", "Nearby taxis", "Hotspots", "Carpark", "Fuel", "Charge", "Hawker food"];

describe("FilterTool", () => {
  it("shows one toggle button per map layer, labelled as in the mockup", () => {
    render(<FilterTool active={new Set()} onToggle={() => {}} />);
    for (const label of LABELS) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
    expect(screen.getAllByRole("button")).toHaveLength(7);
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
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Taxi stands", "Fuel"]);
  });
});
