// Package 9a acceptance tests — SettingsView «boundary»: the dialog map's Settings UI (FR-2). It shows the
// preferences and reports each change; SettingsController saves it (FR-2.2.1).
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { UserPreferences } from "../entity/UserPreferences";
import { SettingsView, type SettingsViewProps } from "./SettingsView";

const defaults: UserPreferences = {
  visibleLayers: new Set(),
  activeSuggestions: new Set(),
  suggestionLayers: new Map(),
  skipNavPrompt: false,
  fontSize: 100,
  darkMode: false,
};

function renderSettings(preferences: Partial<UserPreferences> = {}, props: Partial<SettingsViewProps> = {}) {
  const handlers = {
    onSetVehicleType: vi.fn(),
    onSetDisplay: vi.fn(),
    onSetSkipNavPrompt: vi.fn(),
    onBack: vi.fn(),
    onClose: vi.fn(),
  };
  render(<SettingsView preferences={{ ...defaults, ...preferences }} {...handlers} {...props} />);
  return handlers;
}
const radio = (name: RegExp) => screen.getByRole("radio", { name });
const switchFor = (name: string) => screen.getByRole("switch", { name });

describe("SettingsView", () => {
  it("is a dialog called Settings, with the focus on the way back to the menu", () => {
    renderSettings();
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to the menu" })).toHaveFocus();
  });

  it("shows the vehicle type, and says what each choice hides (FR-2.1.1, D43)", () => {
    renderSettings({ vehicleType: "EV" });
    expect(radio(/^Electric/)).toBeChecked();
    expect(radio(/^Electric/)).toHaveAccessibleName("Electric");
    expect(radio(/^Electric/)).toHaveAccessibleDescription("Hides fuel stations");
    expect(radio(/^Not set/)).not.toBeChecked();
  });

  it("reports a new vehicle type, or none", async () => {
    const { onSetVehicleType } = renderSettings({ vehicleType: "EV" });
    await userEvent.click(radio(/^Petrol or diesel/));
    await userEvent.click(radio(/^Not set/));
    expect(onSetVehicleType.mock.calls).toEqual([["FUEL"], [undefined]]);
  });

  it("shows the text size, and reports a new one with dark mode as it is (the design's setDisplay)", async () => {
    const { onSetDisplay } = renderSettings({ fontSize: 115, darkMode: true });
    expect(radio(/Large$/)).toBeChecked();
    await userEvent.click(radio(/Largest$/));
    expect(onSetDisplay).toHaveBeenCalledExactlyOnceWith(150, true);
  });

  it("shows each text size's sample at its own size, whatever the size now is", () => {
    renderSettings({ fontSize: 150 });
    const samples = [...document.querySelectorAll<HTMLElement>(".settings__sample")].map((s) => s.style.fontSize);
    expect(samples).toEqual([`${100 / 150}rem`, `${115 / 150}rem`, `${130 / 150}rem`, "1rem"]);
  });

  it("turns dark mode on and off, keeping the text size (D44)", async () => {
    const { onSetDisplay } = renderSettings({ fontSize: 130 });
    expect(switchFor("Dark mode")).toHaveAttribute("aria-checked", "false");
    expect(switchFor("Dark mode")).toHaveAccessibleDescription("Dark menus and a night map");
    await userEvent.click(switchFor("Dark mode"));
    expect(onSetDisplay).toHaveBeenCalledExactlyOnceWith(130, true);
  });

  it("brings back the navigation prompt that 'Do not show this again' took away (D39)", async () => {
    const { onSetSkipNavPrompt } = renderSettings({ skipNavPrompt: true });
    expect(switchFor("Ask before opening Google Maps")).toHaveAttribute("aria-checked", "false");
    await userEvent.click(switchFor("Ask before opening Google Maps"));
    expect(onSetSkipNavPrompt).toHaveBeenCalledExactlyOnceWith(false);
  });

  it("goes back to the menu (the dialog map's Exit), or closes with its button, a tap outside or Escape", async () => {
    const { onBack, onClose } = renderSettings();
    await userEvent.click(screen.getByRole("button", { name: "Back to the menu" }));
    await userEvent.click(screen.getByRole("button", { name: "Close the menu" }));
    fireEvent.click(document.querySelector(".drawer__overlay")!);
    await userEvent.keyboard("{Escape}");
    expect(onBack).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
