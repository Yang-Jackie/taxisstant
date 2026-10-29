import chevronRight from "@tabler/icons/outline/chevron-right.svg?raw";
import star from "@tabler/icons/outline/star.svg?raw";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LAYER_TYPES, type LayerType } from "../entity/LayerType";
import { GROUP, LAYER_ICON } from "./markerIcons";
import "./FilterTool.css";

const NOTHING_LOADING: ReadonlySet<LayerType> = new Set();

/** The mockup's order: the layers for finding passengers (amber), then those for a break (green). */
const MOCKUP_ORDER: readonly LayerType[] = ["HOTSPOT", "TAXI_STAND", "TAXIS", "FUEL", "CHARGING", "CARPARK", "HAWKER"];

/** One button in the sheet: a layer, or the Bookmarks filter (D53). */
interface Filter {
  readonly key: string;
  readonly icon: string;
  readonly label: string;
  /** Its colour: its layer's group, or bookmarks' own red (D53). */
  readonly group: "find" | "rest" | "bookmark";
  readonly on: boolean;
  /** Its data is on its way. */
  readonly busy: boolean;
  readonly onToggle: () => void;
}

/**
 * The collapsed sheet: icon-only chips in a row that scrolls sideways, with a fade and chevron while more are off to
 * the right. Each chip keeps its layer's name for screen readers and as a tooltip.
 */
function Chips({ filters }: { filters: readonly Filter[] }) {
  const row = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  useEffect(() => {
    const el = row.current;
    if (!el) return;
    const update = () => setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [filters.length]);
  return (
    <div className="filter-tool__peek-area">
      <div ref={row} className="filter-tool__peek">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`filter-tool__chip filter-tool__chip--${f.group}`}
            aria-pressed={f.on}
            aria-busy={f.busy}
            aria-label={f.label}
            title={f.label}
            onClick={f.onToggle}
            dangerouslySetInnerHTML={{ __html: f.icon }}
          />
        ))}
      </div>
      {more && (
        <span className="filter-tool__fade" aria-hidden="true" dangerouslySetInnerHTML={{ __html: chevronRight }} />
      )}
    </div>
  );
}

/** The expanded sheet (the dialog map's Filter menu): a tile per layer, with its icon and name. */
function Tiles({ filters }: { filters: readonly Filter[] }) {
  return (
    <div className="filter-tool__tiles">
      {filters.map((f) => (
        <button
          key={f.key}
          type="button"
          className={`filter-tool__tile filter-tool__tile--${f.group}`}
          aria-pressed={f.on}
          aria-busy={f.busy}
          onClick={f.onToggle}
        >
          <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: f.icon }} />
          {f.label}
        </button>
      ))}
    </div>
  );
}

export interface FilterToolProps {
  active: ReadonlySet<LayerType>;
  onToggle: (t: LayerType) => void;
  /** The layers to offer: all but one the vehicle type hides (D43). Shown in the mockup's order. */
  layers?: readonly LayerType[];
  /** Layers whose data is on its way: a spinner shows, if it takes a moment (NF-3). */
  loading?: ReadonlySet<LayerType>;
  /** The Bookmarks filter, first, before the layers (D53): offered only with somewhere to send its taps. */
  bookmarksShown?: boolean;
  onToggleBookmarks?: () => void;
}

/**
 * The design model's FilterTool, as the mockup's bottom sheet (the dialog map's Filter bar): icon chips that toggle
 * a layer at once, and a handle that expands the sheet to labelled tiles and back. A chip stays lit while its layer is
 * on, in its group's colour.
 */
export function FilterTool({
  active,
  onToggle,
  layers = LAYER_TYPES,
  loading = NOTHING_LOADING,
  bookmarksShown = false,
  onToggleBookmarks,
}: FilterToolProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const bookmarks: Filter[] = onToggleBookmarks
    ? [
        {
          key: "bookmarks",
          icon: star,
          label: t("layers.bookmarks"),
          group: "bookmark",
          on: bookmarksShown,
          busy: false,
          onToggle: onToggleBookmarks,
        },
      ]
    : [];
  const filters: Filter[] = [
    ...bookmarks,
    ...MOCKUP_ORDER.filter((l) => layers.includes(l)).map((layer) => ({
      key: layer,
      icon: LAYER_ICON[layer],
      label: t(`layers.${layer}`),
      group: GROUP[layer],
      on: active.has(layer),
      busy: loading.has(layer),
      onToggle: () => onToggle(layer),
    })),
  ];
  return (
    <nav className="filter-tool" aria-label={t("layers.label")}>
      <button
        type="button"
        className="filter-tool__grip"
        aria-expanded={expanded}
        aria-label={expanded ? t("layers.collapse") : t("layers.expand")}
        onClick={() => setExpanded(!expanded)}
      >
        <span className="filter-tool__bar" />
      </button>
      {expanded ? <Tiles filters={filters} /> : <Chips filters={filters} />}
    </nav>
  );
}
