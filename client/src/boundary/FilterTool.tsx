import { LAYER_TYPES, type LayerType } from "../entity/LayerType";
import "./FilterTool.css";

/** Button labels, as in the team's mockup. */
const LABELS: Record<LayerType, string> = {
  TAXI_STAND: "Taxi stands",
  TAXIS: "Nearby taxis",
  HOTSPOT: "Hotspots",
  CARPARK: "Carpark",
  FUEL: "Fuel",
  CHARGING: "Charge",
  HAWKER: "Hawker food",
};

export interface FilterToolProps {
  active: ReadonlySet<LayerType>;
  onToggle: (t: LayerType) => void;
}

export function FilterTool({ active, onToggle }: FilterToolProps) {
  return (
    <nav className="filter-tool" aria-label="Map layers">
      {LAYER_TYPES.map((t) => (
        <button key={t} type="button" aria-pressed={active.has(t)} onClick={() => onToggle(t)}>
          {LABELS[t]}
        </button>
      ))}
    </nav>
  );
}
