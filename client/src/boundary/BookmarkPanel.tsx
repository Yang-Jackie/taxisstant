import { useTranslation } from "react-i18next";
import type { Bookmark } from "../entity/Bookmark";
import type { Location } from "../entity/Location";
import { distance } from "./format";
import { GROUP, LAYER_ICON } from "./markerIcons";

export interface BookmarkPanelProps {
  /** Newest first. */
  items: readonly Bookmark[];
  /** Where the driver is, to say how far each one is. */
  from?: Location;
  /** The design model's BookmarkPanel.onSelect: show it on the map (UC 0011 step 2). */
  onSelect: (b: Bookmark) => void;
}

/** The driver's bookmarks (UC 0011's bookmark menu, in the side menu, D40): the design model's BookmarkPanel. */
export function BookmarkPanel({ items, from, onSelect }: BookmarkPanelProps) {
  const { t } = useTranslation();
  if (items.length === 0) return <p className="bookmark-panel__empty">{t("bookmarks.empty")}</p>;
  return (
    <ul className="bookmark-panel">
      {items.map((b) => (
        <li key={b.id}>
          <button type="button" onClick={() => onSelect(b)}>
            <span
              className={`bookmark-panel__icon bookmark-panel__icon--${GROUP[b.layer]}`}
              aria-hidden="true"
              dangerouslySetInnerHTML={{ __html: LAYER_ICON[b.layer] }}
            />
            <span className="bookmark-panel__text">
              <span className="bookmark-panel__name">{b.label}</span>
              <span className="bookmark-panel__kind">{t(`bookmarks.kind.${b.layer}`)}</span>
            </span>
            {from && <span className="bookmark-panel__distance">{distance(from.distanceTo(b.location), t)}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}
