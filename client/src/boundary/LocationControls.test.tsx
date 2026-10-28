// Package 6 tests — the location button (UC 0013 3a, D31) and the denied banner (UC 0013 1a, D30).
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LocationBanner } from "./LocationBanner";
import { LocationButton } from "./LocationButton";

describe("LocationButton", () => {
  it("centres the map when tapped", async () => {
    const onClick = vi.fn();
    render(<LocationButton enabled highlighted={false} onClick={onClick} />);
    await userEvent.click(screen.getByRole("button", { name: "Centre the map on my location" }));
    expect(onClick).toHaveBeenCalled();
  });

  it("lights up when the driver is away from the middle of the screen", () => {
    render(<LocationButton enabled highlighted onClick={vi.fn()} />);
    expect(screen.getByRole("button")).toHaveClass("location-button--highlighted");
    expect(screen.getByRole("button")).toHaveAttribute("title", "Back to my location");
  });

  it("can't be tapped before there is a position", () => {
    render(<LocationButton enabled={false} highlighted={false} onClick={vi.fn()} />);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});

describe("LocationBanner", () => {
  it("says what UC 0013 says, and offers steps instead of opening settings (D30)", async () => {
    render(<LocationBanner onRetry={vi.fn()} userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)" />);
    expect(screen.getByRole("region", { name: "Location access" })).toHaveTextContent(
      "Location access required to show real-time position.",
    );

    await userEvent.click(screen.getByRole("button", { name: "How to turn it on" }));

    expect(screen.getByRole("list")).toHaveTextContent(/Privacy & Security.*Location Services.*Safari Websites/);
  });

  it("gives Android Chrome its own steps", async () => {
    render(<LocationBanner onRetry={vi.fn()} userAgent="Mozilla/5.0 (Linux; Android 15) Chrome/140" />);
    await userEvent.click(screen.getByRole("button", { name: "How to turn it on" }));
    expect(screen.getByRole("list")).toHaveTextContent(/Permissions.*Location to Allow/);
  });

  it("tries again when asked", async () => {
    const onRetry = vi.fn();
    render(<LocationBanner onRetry={onRetry} userAgent="" />);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalled();
  });
});
