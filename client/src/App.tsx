import { useState } from "react";
import { FilterTool } from "./boundary/FilterTool";
import { MapView } from "./boundary/MapView";
import type { LayerType } from "./entity/LayerType";
import { Location } from "./entity/Location";
import { TaxiStand } from "./entity/TaxiStand";
import "./App.css";

/** Hard-coded for M4 — real data from your server arrives in M5. (Coordinates from your LTA recording.) */
const SAMPLE_STANDS: readonly TaxiStand[] = [
  new TaxiStand({ id: "A01", name: "Orchard Rd along driveway of Lucky Plaza", location: new Location(1.304294727, 103.8338467), standType: "Stand", isBarrierFree: true }),
  new TaxiStand({ id: "A05", name: "Mt Elizabeth Rd at Mt Elizabeth Hospital", location: new Location(1.304571786, 103.835547), standType: "Stand", isBarrierFree: true }),
  new TaxiStand({ id: "A06", name: "Cairnhill Rd at Cairnhill Nine", location: new Location(1.303519805, 103.8376729), standType: "Stop", isBarrierFree: true }),
];

export function App() {
  const [active, setActive] = useState<ReadonlySet<LayerType>>(() => new Set());

  function toggle(t: LayerType) {
    setActive((previous) => {
      const next = new Set(previous);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  return (
    <div className="app">
      <MapView taxiStands={active.has("TAXI_STAND") ? SAMPLE_STANDS : []} />
      <FilterTool active={active} onToggle={toggle} />
    </div>
  );
}
