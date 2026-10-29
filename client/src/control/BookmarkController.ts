import { z } from "zod";
import { bookmarkIdOf, bookmarkOf, type Bookmark } from "../entity/Bookmark";
import type { BookmarkList } from "../entity/BookmarkList";
import type { Landmark } from "../entity/Landmark";
import { STATIC_LAYERS, type LayerType } from "../entity/LayerType";
import { Location } from "../entity/Location";
import type { MapDataRepository } from "../entity/MapDataRepository";
import type { LocalStore } from "../services/LocalStore";
import type { DataSyncController } from "./DataSyncController";
import type { DataSyncObserver } from "./DataSyncObserver";
import type { MapDisplayController } from "./MapDisplayController";
import type { SettingsController } from "./SettingsController";
import { Store } from "./Store";

const KEY = "bookmarks";

/** One saved bookmark, as IndexedDB keeps it. */
const SavedBookmark = z.object({
  id: z.string(),
  layer: z.enum(STATIC_LAYERS),
  landmarkId: z.string(),
  label: z.string(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  dateSaved: z.iso.datetime(),
});

export interface BookmarkState {
  /** Newest first. */
  readonly bookmarks: readonly Bookmark[];
  /** Their ids, to light a landmark's star. */
  readonly ids: ReadonlySet<string>;
  /** With the Bookmarks filter on, their landmarks as they are in today's data, to show on the map (D53). */
  readonly onMap: readonly Landmark[];
}

/** Saves landmarks to find again, and finds them (UC 0011): the design model's BookmarkController «control». */
export class BookmarkController extends Store<BookmarkState> implements DataSyncObserver {
  private readonly list: BookmarkList;
  private readonly localStore: Pick<LocalStore, "read" | "write">;
  private readonly repo: MapDataRepository;
  private readonly dataSync: Pick<DataSyncController, "refreshLayer">;
  private readonly mapDisplay: Pick<MapDisplayController, "showNotice" | "highlight">;
  private readonly settings: Pick<SettingsController, "getPreferences" | "setBookmarksShown" | "subscribe">;

  constructor(
    list: BookmarkList,
    localStore: Pick<LocalStore, "read" | "write">,
    repo: MapDataRepository,
    dataSync: Pick<DataSyncController, "refreshLayer">,
    mapDisplay: Pick<MapDisplayController, "showNotice" | "highlight">,
    settings: Pick<SettingsController, "getPreferences" | "setBookmarksShown" | "subscribe">,
  ) {
    super({ bookmarks: [], ids: new Set(), onMap: [] });
    this.list = list;
    this.localStore = localStore;
    this.repo = repo;
    this.dataSync = dataSync;
    this.mapDisplay = mapDisplay;
    this.settings = settings;
    settings.subscribe(() => this.updateMap()); // the filter turned on or off, whatever turned it
  }

  /** Restores the saved bookmarks. A saved one that doesn't fit is left out (stored data may be old or tampered with). */
  async load(): Promise<void> {
    const saved = await this.localStore.read(KEY);
    for (const item of Array.isArray(saved) ? saved : []) {
      const b = SavedBookmark.safeParse(item);
      if (!b.success) continue;
      const { latitude, longitude, dateSaved, ...rest } = b.data;
      this.list.add({ ...rest, location: new Location(latitude, longitude), dateSaved: new Date(dateSaved) });
    }
    this.publish();
  }

  getBookmarks(): Bookmark[] {
    return this.list.getAll();
  }

  isBookmarked(l: Landmark): boolean {
    return this.list.has(bookmarkIdOf(l));
  }

  /** The star in a landmark's popup: bookmark it, or take the bookmark away (UC 0011's alternative flows). */
  async toggleBookmark(l: Landmark): Promise<void> {
    const id = bookmarkIdOf(l);
    const adding = !this.list.has(id);
    if (adding) this.list.add(bookmarkOf(l, new Date()));
    else this.list.remove(id);
    this.publish();
    this.mapDisplay.showNotice(adding ? "bookmarkAdded" : "bookmarkRemoved"); // UC 0011's messages
    await this.save();
  }

  /**
   * A bookmark chosen in the side menu: show its landmark highlighted (steps 2–4), as it is in today's data. One that
   * is no longer there, or whose layer can't be loaded, gives exception 3a.
   */
  async openBookmark(id: string): Promise<void> {
    const b = this.list.get(id);
    if (!b) return;
    let landmark = this.find(b);
    if (!landmark) {
      try {
        await this.dataSync.refreshLayer(b.layer); // not loaded yet this session
        landmark = this.find(b);
      } catch {
        // nothing saved and nothing downloaded: 3a below
      }
    }
    if (landmark) this.mapDisplay.highlight(landmark);
    else this.mapDisplay.showNotice("bookmarkNotFound"); // exception 3a
  }

  /**
   * The Bookmarks filter (D53): every bookmark on the map, whatever layers are on, or none again. Turned on, it loads
   * the layers not loaded yet this session; a bookmark still not found gives exception 3a, as opening it would.
   */
  async toggleShown(): Promise<void> {
    const on = !this.settings.getPreferences().showBookmarks;
    await this.settings.setBookmarksShown(on);
    if (!on) return;
    if (this.list.getAll().length === 0) {
      this.mapDisplay.showNotice("noBookmarks");
      return;
    }
    const missing = new Set(
      this.list
        .getAll()
        .filter((b) => !this.find(b))
        .map((b) => b.layer),
    );
    await Promise.all([...missing].map((t) => this.dataSync.refreshLayer(t).catch(() => undefined)));
    if (!this.settings.getPreferences().showBookmarks) return; // turned off again meanwhile
    this.updateMap();
    if (this.getSnapshot().onMap.length < this.list.getAll().length) this.mapDisplay.showNotice("bookmarkNotFound");
  }

  /** A layer's new data: its bookmarks show as they are now, or go if they're no longer there. */
  onDataUpdated(t: LayerType): void {
    if (this.list.getAll().some((b) => b.layer === t)) this.updateMap();
  }

  /** `b`'s landmark in today's data, if it's still there and its layer has loaded. */
  private find(b: Bookmark): Landmark | undefined {
    return this.repo.getByLayerType(b.layer).find((l) => l.id === b.landmarkId);
  }

  /** The landmarks to show on the map: none while the filter is off. */
  private landmarksOnMap(): Landmark[] {
    if (!this.settings.getPreferences().showBookmarks) return [];
    return this.list.getAll().flatMap((b) => this.find(b) ?? []);
  }

  private updateMap(): void {
    const state = this.getSnapshot();
    const onMap = this.landmarksOnMap();
    if (onMap.length === state.onMap.length && onMap.every((l, i) => l === state.onMap[i])) return;
    this.setState({ ...state, onMap });
  }

  private publish(): void {
    const bookmarks = this.list.getAll();
    this.setState({ bookmarks, ids: new Set(bookmarks.map((b) => b.id)), onMap: this.landmarksOnMap() });
  }

  private async save(): Promise<void> {
    await this.localStore.write(
      KEY,
      this.list.getAll().map((b) => ({
        id: b.id,
        layer: b.layer,
        landmarkId: b.landmarkId,
        label: b.label,
        latitude: b.location.latitude,
        longitude: b.location.longitude,
        dateSaved: b.dateSaved.toISOString(),
      })),
    );
  }
}
