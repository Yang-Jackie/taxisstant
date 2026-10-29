// Package 8 acceptance tests — NavigationPrompt «boundary»: UC 0012 step 3, the dialog map's "Redirect confirmation
// message": open Google Maps, Yes or No, and "Do not show this again" (step 2).
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Location } from "../entity/Location";
import { NavigationPrompt } from "./NavigationPrompt";

const suntec = { location: new Location(1.29375, 103.85718), name: "Suntec City" };

function renderPrompt() {
  const onAnswer = vi.fn<(ok: boolean, doNotShow: boolean) => void>();
  render(<NavigationPrompt target={suntec} onAnswer={onAnswer} />);
  return onAnswer;
}

describe("NavigationPrompt", () => {
  it("asks whether to open Google Maps for directions to the place", () => {
    renderPrompt();
    const dialog = screen.getByRole("alertdialog", { name: "Open Google Maps?" });
    expect(dialog).toHaveAccessibleDescription("Get directions to Suntec City in Google Maps.");
    expect(screen.getByRole("checkbox", { name: "Do not show this again" })).not.toBeChecked();
  });

  it("answers Yes, or Yes with 'Do not show this again' ticked", async () => {
    const onAnswer = renderPrompt();
    await userEvent.click(screen.getByRole("button", { name: "Yes" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Do not show this again" }));
    await userEvent.click(screen.getByRole("button", { name: "Yes" }));
    expect(onAnswer.mock.calls).toEqual([
      [true, false],
      [true, true],
    ]);
  });

  it("answers No with its button, a tap outside it, or Escape", async () => {
    const onAnswer = renderPrompt();
    await userEvent.click(screen.getByRole("button", { name: "No" }));
    fireEvent.click(document.querySelector(".nav-prompt__overlay")!);
    await userEvent.keyboard("{Escape}");
    expect(onAnswer.mock.calls.map(([ok]) => ok)).toEqual([false, false, false]);
  });

  it("puts the focus on Yes, so a keyboard or screen reader starts there", () => {
    renderPrompt();
    expect(screen.getByRole("button", { name: "Yes" })).toHaveFocus();
  });
});
