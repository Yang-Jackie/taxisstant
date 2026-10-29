import { z } from "zod";
import { bookmarkIdOf, bookmarkOf, type Bookmark } from "../entity/Bookmark";
import type { BookmarkList } from "../entity/BookmarkList";
import type { Landmark } from "../entity/Landmark";
import { STATIC_LAYERS } from "../entity/LayerType";
import { Location } from "../entity/Location";
import type { MapDataRepository } from "../entity/MapDataRepository";
import type { LocalStore } from "../services/LocalStore";
import type { DataSyncController } from "./DataSyncController";
import type { MapDisplayController } from "./MapDisplayController";
import { Store } from "./Store";

const KEY = "bookmarks";

/** UC 0011's messages, in its words. */
const FAVOURITED = "Location has been favourited";
const UNFAVOURITED = "Location has been unfavourited";
const NOT_FOUND = "Unable to find bookmarked location. Please try again later";

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
}

/** Saves landmarks to find again, and finds them (UC 0011): the design model's BookmarkController «control». */
export class BookmarkController extends Store<BookmarkState> {
  private readonly list: BookmarkList;
  private readonly localStore: Pick<LocalStore, "read" | "write">;
  private readonly repo: MapDataRepository;
  private readonly dataSync: Pick<DataSyncController, "refreshLayer">;
  private readonly mapDisplay: Pick<MapDisplayController, "showNotice" | "highlight">;

  constructor(
    list: BookmarkList,
    localStore: Pick<LocalStore, "read" | "write">,
    repo: MapDataRepository,
    dataSync: Pick<DataSyncController, "refreshLayer">,
    mapDisplay: Pick<MapDisplayController, "showNotice" | "highlight">,
  ) {
    super({ bookmarks: [], ids: new Set() });
    this.list = list;
    this.localStore = localStore;
    this.repo = repo;
    this.dataSync = dataSync;
    this.mapDisplay = mapDisplay;
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
    this.mapDisplay.showNotice(adding ? FAVOURITED : UNFAVOURITED);
    await this.save();
  }

  /**
   * A bookmark chosen in the side menu: show its landmark highlighted (steps 2–4), as it is in today's data. One that
   * is no longer there, or whose layer can't be loaded, gives exception 3a.
   */
  async openBookmark(id: string): Promise<void> {
    const b = this.list.get(id);
    if (!b) return;
    const find = () => this.repo.getByLayerType(b.layer).find((l) => l.id === b.landmarkId);
    let landmark = find();
    if (!landmark) {
      try {
        await this.dataSync.refreshLayer(b.layer); // not loaded yet this session
        landmark = find();
      } catch {
        // nothing saved and nothing downloaded: 3a below
      }
    }
    if (landmark) this.mapDisplay.highlight(landmark);
    else this.mapDisplay.showNotice(NOT_FOUND);
  }

  private publish(): void {
    const bookmarks = this.list.getAll();
    this.setState({ bookmarks, ids: new Set(bookmarks.map((b) => b.id)) });
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
