// Package 8 acceptance tests — BookmarkController «control»: UC 0011 Bookmarks. The star bookmarks a landmark or
// takes the bookmark away, with UC 0011's messages; choosing a bookmark shows its landmark highlighted (steps 2–4),
// or exception 3a's toast when it can't be found. Saved through LocalStore (D42).
import { describe, expect, it } from "vitest";
import type { Viewport } from "../entity/Bounds";
import { BookmarkList } from "../entity/BookmarkList";
import { Carpark } from "../entity/Carpark";
import type { Landmark } from "../entity/Landmark";
import { Location } from "../entity/Location";
import { MapDataRepository } from "../entity/MapDataRepository";
import { CacheManager } from "../services/CacheManager";
import { DataApiClient } from "../services/DataApiClient";
import { CARPARKS, fakeServer, offline, ok, type Answer } from "../testing/fakeServer";
import { BookmarkController } from "./BookmarkController";
import { DataSyncController } from "./DataSyncController";
import { MapDisplayController, SINGAPORE_VIEW } from "./MapDisplayController";
import { SettingsController } from "./SettingsController";
import { toastText } from "../testing/toastText";

function memoryStore(initial: Record<string, unknown> = {}) {
  const data = new Map<string, unknown>(Object.entries(initial));
  return { data, read: async (k: string) => data.get(k), write: async (k: string, v: unknown) => void data.set(k, v) };
}

const STREET_LEVEL: Viewport = { bounds: SINGAPORE_VIEW.bounds, zoom: 18 };

/** The controllers wired as in startup.ts, with a fake server and in-memory storage. */
function setUp(answers: Record<string, Answer> = {}, store = memoryStore()) {
  const repo = new MapDataRepository();
  const settings = new SettingsController(store);
  const dataSync = new DataSyncController(
    new DataApiClient({ fetchFn: fakeServer(answers) }),
    repo,
    new CacheManager(store),
  );
  const mapDisplay = new MapDisplayController(settings, dataSync, repo);
  dataSync.attach(mapDisplay);
  mapDisplay.refreshVisible(STREET_LEVEL);
  const bookmarks = new BookmarkController(new BookmarkList(), store, repo, dataSync, mapDisplay);
  return { store, repo, dataSync, mapDisplay, bookmarks };
}

/** Suntec City, as the carpark layer has it once loaded. */
async function suntecIn(dataSync: DataSyncController, repo: MapDataRepository): Promise<Landmark> {
  await dataSync.refreshLayer("CARPARK");
  return repo.getByLayerType("CARPARK").find((c) => c.id === "1")!;
}

describe("BookmarkController — the star (UC 0011's alternative flows)", () => {
  it("bookmarks an unbookmarked landmark, and says so", async () => {
    const { repo, dataSync, mapDisplay, bookmarks } = setUp();
    const suntec = await suntecIn(dataSync, repo);

    await bookmarks.toggleBookmark(suntec);

    expect(bookmarks.isBookmarked(suntec)).toBe(true);
    expect(bookmarks.getSnapshot().bookmarks.map((b) => b.label)).toEqual(["Suntec City"]);
    expect(bookmarks.getSnapshot().ids.has("CARPARK:1")).toBe(true);
    expect(toastText(mapDisplay.getSnapshot().notice)).toBe("Location has been favourited");
  });

  it("takes the bookmark away when the star is lit, and says so", async () => {
    const { repo, dataSync, mapDisplay, bookmarks } = setUp();
    const suntec = await suntecIn(dataSync, repo);
    await bookmarks.toggleBookmark(suntec);

    await bookmarks.toggleBookmark(suntec);

    expect(bookmarks.isBookmarked(suntec)).toBe(false);
    expect(bookmarks.getBookmarks()).toEqual([]);
    expect(toastText(mapDisplay.getSnapshot().notice)).toBe("Location has been unfavourited");
  });

  it('saves them under "bookmarks" as plain data, and load() brings them back, newest first', async () => {
    const store = memoryStore();
    const { repo, dataSync, bookmarks } = setUp({}, store);
    await dataSync.refreshLayer("CARPARK");
    const [suntec, amk] = repo.getByLayerType("CARPARK");
    await bookmarks.toggleBookmark(suntec!);
    await new Promise((resolve) => setTimeout(resolve, 2)); // saved a moment later
    await bookmarks.toggleBookmark(amk!);

    expect(store.data.get("bookmarks")).toEqual([
      expect.objectContaining({ id: "CARPARK:A2", layer: "CARPARK", landmarkId: "A2", latitude: 1.366237 }),
      {
        id: "CARPARK:1",
        layer: "CARPARK",
        landmarkId: "1",
        label: "Suntec City",
        latitude: 1.29375,
        longitude: 103.85718,
        dateSaved: expect.stringMatching(/^2\d{3}-\d\d-\d\dT/),
      },
    ]);
    const afterReload = setUp({}, store).bookmarks;
    await afterReload.load();
    expect(afterReload.getBookmarks().map((b) => b.id)).toEqual(["CARPARK:A2", "CARPARK:1"]);
    expect(afterReload.getBookmarks()[1]!.location).toBeInstanceOf(Location);
  });

  it("load() leaves out saved bookmarks that don't fit (stored data may be old or tampered with)", async () => {
    const good = {
      id: "FUEL:way/1",
      layer: "FUEL",
      landmarkId: "way/1",
      label: "Shell",
      latitude: 1.37,
      longitude: 103.76,
      dateSaved: "2026-10-29T13:00:00.000Z",
    };
    const store = memoryStore({
      bookmarks: [good, { ...good, id: "x", layer: "TAXIS" }, { ...good, id: "y", latitude: 95 }, 7],
    });
    const { bookmarks } = setUp({}, store);

    await bookmarks.load();

    expect(bookmarks.getBookmarks().map((b) => b.id)).toEqual(["FUEL:way/1"]);
  });

  it("load() starts with none when nothing, or something unexpected, was saved", async () => {
    const { bookmarks } = setUp({}, memoryStore({ bookmarks: "hello" }));
    await bookmarks.load();
    expect(bookmarks.getSnapshot()).toEqual({ bookmarks: [], ids: new Set() });
  });
});

describe("BookmarkController.openBookmark (UC 0011 steps 2–4)", () => {
  it("shows the landmark highlighted, as today's data has it, and moves the map to it", async () => {
    const { repo, dataSync, mapDisplay, bookmarks } = setUp();
    const suntec = await suntecIn(dataSync, repo);
    await bookmarks.toggleBookmark(suntec);

    await bookmarks.openBookmark("CARPARK:1");

    expect(mapDisplay.getSnapshot().highlighted).toBe(suntec);
    expect(mapDisplay.getSnapshot().focus?.location).toBe(suntec.location);
  });

  it("loads its layer first when it isn't loaded yet this session", async () => {
    const store = memoryStore();
    const first = setUp({}, store);
    await first.bookmarks.toggleBookmark(await suntecIn(first.dataSync, first.repo));
    store.data.delete("cache:/carparks"); // nothing saved of the layer, and its download at startup not done yet
    const { repo, mapDisplay, bookmarks } = setUp({}, store); // the app opened again
    await bookmarks.load();

    await bookmarks.openBookmark("CARPARK:1");

    expect(mapDisplay.getSnapshot().highlighted).toBe(repo.getByLayerType("CARPARK").find((c) => c.id === "1"));
  });

  it("3a: says it can't find a landmark that is no longer in the data, e.g. a carpark that closed", async () => {
    const store = memoryStore();
    const first = setUp({}, store);
    await first.bookmarks.toggleBookmark(await suntecIn(first.dataSync, first.repo));
    store.data.delete("cache:/carparks"); // so the next session downloads today's list
    const { mapDisplay, bookmarks } = setUp(
      {
        "/carparks": ok(
          CARPARKS.filter((c) => c.id !== "1"),
          '"v2"',
        ),
      },
      store,
    );
    await bookmarks.load();

    await bookmarks.openBookmark("CARPARK:1");

    expect(mapDisplay.getSnapshot().highlighted).toBeNull();
    expect(toastText(mapDisplay.getSnapshot().notice)).toBe(
      "Unable to find bookmarked location. Please try again later",
    );
  });

  it("3a: says it can't find it when its layer can't be loaded at all", async () => {
    const store = memoryStore();
    const first = setUp({}, store);
    await first.bookmarks.toggleBookmark(await suntecIn(first.dataSync, first.repo));
    store.data.delete("cache:/carparks"); // the saved copy of the layer is gone too
    const { mapDisplay, bookmarks } = setUp({ "*": offline }, store);
    await bookmarks.load();

    await bookmarks.openBookmark("CARPARK:1");

    expect(toastText(mapDisplay.getSnapshot().notice)).toBe(
      "Unable to find bookmarked location. Please try again later",
    );
  });
});

describe("MapDisplayController — the highlight", () => {
  it("ends when the highlighted landmark's details close, but not when an earlier one's do", async () => {
    const { repo, dataSync, mapDisplay } = setUp();
    await dataSync.refreshLayer("CARPARK");
    const [suntec, amk] = repo.getByLayerType("CARPARK") as Carpark[];
    mapDisplay.highlight(suntec!);
    mapDisplay.highlight(amk!);

    mapDisplay.clearHighlight(suntec!); // the first one's details close as the second's open
    expect(mapDisplay.getSnapshot().highlighted).toBe(amk);
    mapDisplay.clearHighlight(amk!);
    expect(mapDisplay.getSnapshot().highlighted).toBeNull();
  });
});
