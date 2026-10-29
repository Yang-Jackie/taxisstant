// Package 8 tests — Bookmark (D42) and BookmarkList «container» (the design model's add, remove, getAll).
import { describe, expect, it } from "vitest";
import { bookmarkIdOf, bookmarkOf, type Bookmark } from "./Bookmark";
import { BookmarkList } from "./BookmarkList";
import { Carpark } from "./Carpark";
import type { Landmark } from "./Landmark";
import { Location } from "./Location";
import { TaxiStand } from "./TaxiStand";

const suntec = new Carpark({ id: "1", name: "Suntec City", location: new Location(1.29375, 103.85718), agency: "LTA" });
const stand = new TaxiStand({
  id: "1",
  name: "Lucky Plaza",
  location: new Location(1.3043, 103.8338),
  standType: "Stand",
  isBarrierFree: true,
});
const savedAt = (iso: string, l: Landmark = suntec): Bookmark => bookmarkOf(l, new Date(iso));

describe("Bookmark", () => {
  it("is one per landmark: its id is the layer and the landmark's id, so ids on two layers don't clash", () => {
    expect(bookmarkIdOf(suntec)).toBe("CARPARK:1");
    expect(bookmarkIdOf(stand)).toBe("TAXI_STAND:1");
  });

  it("keeps the landmark's name and place when saved, and when (D42)", () => {
    const at = new Date("2026-10-29T13:00:00Z");
    expect(bookmarkOf(suntec, at)).toEqual({
      id: "CARPARK:1",
      layer: "CARPARK",
      landmarkId: "1",
      label: "Suntec City",
      location: suntec.location,
      dateSaved: at,
    });
  });
});

describe("BookmarkList", () => {
  it("starts empty", () => {
    expect(new BookmarkList().getAll()).toEqual([]);
  });

  it("gives them newest first", () => {
    const list = new BookmarkList();
    list.add(savedAt("2026-10-29T10:00:00Z"));
    list.add(savedAt("2026-10-29T12:00:00Z", stand));
    expect(list.getAll().map((b) => b.id)).toEqual(["TAXI_STAND:1", "CARPARK:1"]);
  });

  it("holds one bookmark per id: adding it again replaces it", () => {
    const list = new BookmarkList();
    list.add(savedAt("2026-10-29T10:00:00Z"));
    list.add(savedAt("2026-10-29T11:00:00Z"));
    expect(list.getAll()).toHaveLength(1);
    expect(list.get("CARPARK:1")?.dateSaved).toEqual(new Date("2026-10-29T11:00:00Z"));
  });

  it("removes one by id, and says which it has", () => {
    const list = new BookmarkList();
    list.add(savedAt("2026-10-29T10:00:00Z"));
    list.add(savedAt("2026-10-29T10:00:00Z", stand));
    list.remove("CARPARK:1");
    expect([list.has("CARPARK:1"), list.has("TAXI_STAND:1")]).toEqual([false, true]);
    expect(list.get("CARPARK:1")).toBeUndefined();
  });

  it("can't be changed through the list it hands out", () => {
    const list = new BookmarkList();
    list.add(savedAt("2026-10-29T10:00:00Z"));
    list.getAll().pop();
    expect(list.getAll()).toHaveLength(1);
  });
});
