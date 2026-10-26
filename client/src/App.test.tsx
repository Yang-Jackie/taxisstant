// M4 acceptance tests — App: the map and the toggles working together (UC 0001 main flow, with
// hard-coded stands for now; real data arrives in M5).
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";

function markerCount(container: HTMLElement) {
  return container.querySelectorAll(".leaflet-marker-icon").length;
}

describe("App", () => {
  it("starts with Taxi stands off and no markers", () => {
    const { container } = render(<App />);
    expect(screen.getByRole("button", { name: "Taxi stands" })).toHaveAttribute("aria-pressed", "false");
    expect(markerCount(container)).toBe(0);
  });

  it("shows taxi stand markers when Taxi stands is turned on (UC 0001 steps 1–5)", async () => {
    const { container } = render(<App />);

    await userEvent.click(screen.getByRole("button", { name: "Taxi stands" }));

    expect(screen.getByRole("button", { name: "Taxi stands" })).toHaveAttribute("aria-pressed", "true");
    expect(markerCount(container)).toBeGreaterThan(0);
  });

  it("removes them again when it's turned off (UC 0001 alternative flow 2a)", async () => {
    const { container } = render(<App />);
    const toggle = screen.getByRole("button", { name: "Taxi stands" });

    await userEvent.click(toggle);
    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(markerCount(container)).toBe(0);
  });

  it("keeps each layer's toggle independent", async () => {
    render(<App />);

    await userEvent.click(screen.getByRole("button", { name: "Taxi stands" }));
    await userEvent.click(screen.getByRole("button", { name: "Fuel" }));
    await userEvent.click(screen.getByRole("button", { name: "Fuel" }));

    expect(screen.getByRole("button", { name: "Taxi stands" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Fuel" })).toHaveAttribute("aria-pressed", "false");
  });
});
