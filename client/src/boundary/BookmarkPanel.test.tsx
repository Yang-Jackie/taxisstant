// Package 8 acceptance tests — BookmarkPanel «boundary»: UC 0011's bookmark menu, in the side menu (D40).
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Bookmark } from "../entity/Bookmark";
import { Location } from "../entity/Location";
import { BookmarkPanel } from "./BookmarkPanel";

const bookmark = (id: string, layer: Bookmark["layer"], label: string, latitude: number): Bookmark => ({
  id: `${layer}:${id}`,
  layer,
  landmarkId: id,
  label,
  location: new Location(latitude, 103.8338),
  dateSaved: new Date("2026-10-29T13:00:00Z"),
});
const items = [bookmark("1", "CARPARK", "Suntec City", 1.3133), bookmark("A01", "TAXI_STAND", "Lucky Plaza", 1.3044)];

describe("BookmarkPanel", () => {
  it("lists each bookmark with what kind of place it is, in the order given (newest first)", () => {
    render(<BookmarkPanel items={items} onSelect={vi.fn()} />);
    expect(screen.getAllByRole("listitem").map((li) => li.textContent?.trim())).toEqual([
      "Suntec CityCarpark",
      "Lucky PlazaTaxi stand",
    ]);
  });

  it("says how far each one is from the driver", () => {
    render(<BookmarkPanel items={items} from={new Location(1.3043, 103.8338)} onSelect={vi.fn()} />);
    expect(screen.getAllByRole("listitem").map((li) => li.textContent?.trim())).toEqual([
      "Suntec CityCarpark1.0 km",
      "Lucky PlazaTaxi stand10 m",
    ]);
  });

  it("tells which one was chosen (onSelect, UC 0011 step 2)", async () => {
    const onSelect = vi.fn();
    render(<BookmarkPanel items={items} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("button", { name: /Lucky Plaza/ }));
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(items[1]);
  });

  it("says how to make one when there are none", () => {
    render(<BookmarkPanel items={[]} onSelect={vi.fn()} />);
    expect(
      screen.getByText("No bookmarks yet. Tap the star on a place's details to save it here."),
    ).toBeInTheDocument();
  });
});
