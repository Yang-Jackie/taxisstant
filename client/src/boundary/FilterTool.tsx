import chevronRight from "@tabler/icons/outline/chevron-right.svg?raw";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LAYER_TYPES, type LayerType } from "../entity/LayerType";
import { GROUP, LAYER_ICON } from "./markerIcons";
import "./FilterTool.css";

/** The mockup's order: the layers for finding passengers (amber), then those for a break (green). */
const MOCKUP_ORDER: readonly LayerType[] = ["HOTSPOT", "TAXI_STAND", "TAXIS", "FUEL", "CHARGING", "CARPARK", "HAWKER"];

interface ButtonsProps {
  layers: readonly LayerType[];
  active: ReadonlySet<LayerType>;
  onToggle: (t: LayerType) => void;
}

/**
 * The collapsed sheet: icon-only chips in a row that scrolls sideways, with a fade and chevron while more are off to
 * the right. Each chip keeps its layer's name for screen readers and as a tooltip.
 */
function Chips({ layers, active, onToggle }: ButtonsProps) {
  const { t } = useTranslation();
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
  }, [layers]);
  return (
    <div className="filter-tool__peek-area">
      <div ref={row} className="filter-tool__peek">
        {layers.map((layer) => (
          <button
            key={layer}
            type="button"
            className={`filter-tool__chip filter-tool__chip--${GROUP[layer]}`}
            aria-pressed={active.has(layer)}
            aria-label={t(`layers.${layer}`)}
            title={t(`layers.${layer}`)}
            onClick={() => onToggle(layer)}
            dangerouslySetInnerHTML={{ __html: LAYER_ICON[layer] }}
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
function Tiles({ layers, active, onToggle }: ButtonsProps) {
  const { t } = useTranslation();
  return (
    <div className="filter-tool__tiles">
      {layers.map((layer) => (
        <button
          key={layer}
          type="button"
          className={`filter-tool__tile filter-tool__tile--${GROUP[layer]}`}
          aria-pressed={active.has(layer)}
          onClick={() => onToggle(layer)}
        >
          <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: LAYER_ICON[layer] }} />
          {t(`layers.${layer}`)}
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
}

/**
 * The design model's FilterTool, as the mockup's bottom sheet (the dialog map's Filter bar): icon chips that toggle
 * a layer at once, and a handle that expands the sheet to labelled tiles and back. A chip stays lit while its layer is
 * on, in its group's colour.
 */
export function FilterTool({ active, onToggle, layers = LAYER_TYPES }: FilterToolProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const shown = MOCKUP_ORDER.filter((l) => layers.includes(l));
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
      {expanded ? (
        <Tiles layers={shown} active={active} onToggle={onToggle} />
      ) : (
        <Chips layers={shown} active={active} onToggle={onToggle} />
      )}
    </nav>
  );
}
