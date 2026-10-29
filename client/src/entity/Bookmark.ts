import type { Landmark } from "./Landmark";
import type { StaticLayer } from "./LayerType";
import type { Location } from "./Location";

/** A landmark the driver saved to find again (UC 0011): the design model's Bookmark, with an id and a snapshot (D42). */
export interface Bookmark {
  /** The landmark's layer and id: one bookmark per landmark. */
  readonly id: string;
  readonly layer: StaticLayer;
  readonly landmarkId: string;
  /** The landmark's name when it was saved. */
  readonly label: string;
  /** Where it was when saved, so the list can say how far it is before its layer has loaded. */
  readonly location: Location;
  readonly dateSaved: Date;
}

/** The id the bookmark for `l` has, saved or not. */
export function bookmarkIdOf(l: Landmark): string {
  return `${l.getType()}:${l.id}`;
}

/** A new bookmark for `l`. */
export function bookmarkOf(l: Landmark, dateSaved: Date): Bookmark {
  return { id: bookmarkIdOf(l), layer: l.getType(), landmarkId: l.id, label: l.name, location: l.location, dateSaved };
}
