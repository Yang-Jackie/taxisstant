import type { Bookmark } from "./Bookmark";

/** The driver's bookmarks: the design model's BookmarkList «container». One per id; newest first. */
export class BookmarkList {
  private readonly items = new Map<string, Bookmark>();

  /** Adds `b`, or replaces the bookmark with its id. */
  add(b: Bookmark): void {
    this.items.delete(b.id);
    this.items.set(b.id, b);
  }

  remove(id: string): void {
    this.items.delete(id);
  }

  get(id: string): Bookmark | undefined {
    return this.items.get(id);
  }

  has(id: string): boolean {
    return this.items.has(id);
  }

  /** Newest first. A copy: changing it changes nothing here. */
  getAll(): Bookmark[] {
    return [...this.items.values()].sort((a, b) => b.dateSaved.getTime() - a.dateSaved.getTime());
  }
}
