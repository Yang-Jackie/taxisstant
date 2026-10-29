import { useTranslation } from "react-i18next";
import { LAYER_TYPES, type LayerType } from "../entity/LayerType";
import "./FilterTool.css";

export interface FilterToolProps {
  active: ReadonlySet<LayerType>;
  onToggle: (t: LayerType) => void;
  /** The buttons to show: all layers but one the vehicle type hides (D43). */
  layers?: readonly LayerType[];
}

/** The layer toggles, labelled as in the team's mockup. */
export function FilterTool({ active, onToggle, layers = LAYER_TYPES }: FilterToolProps) {
  const { t } = useTranslation();
  return (
    <nav className="filter-tool" aria-label={t("layers.label")}>
      {layers.map((layer) => (
        <button key={layer} type="button" aria-pressed={active.has(layer)} onClick={() => onToggle(layer)}>
          {t(`layers.${layer}`)}
        </button>
      ))}
    </nav>
  );
}
