import type { TaxiStandDto } from "@taxisstant/shared";
import { useCallback, useState } from "react";
import { FilterTool } from "./boundary/FilterTool";
import { MapView } from "./boundary/MapView";
import { Toast } from "./boundary/Toast";
import type { LayerType } from "./entity/LayerType";
import type { TaxiStand } from "./entity/TaxiStand";
import { DataApiClient } from "./services/DataApiClient";
import { toTaxiStand } from "./services/toTaxiStand";
import "./App.css";

const api = new DataApiClient();

export function App() {
  const [active, setActive] = useState<ReadonlySet<LayerType>>(() => new Set());
  const [taxiStands, setTaxiStands] = useState<readonly TaxiStand[] | null>(null); // null = not loaded yet
  const [notice, setNotice] = useState<string | null>(null);

  function setLayer(t: LayerType, on: boolean) {
    setActive((previous) => {
      const next = new Set(previous);
      if (on) next.add(t);
      else next.delete(t);
      return next;
    });
  }

  async function toggle(t: LayerType) {
    const turningOn = !active.has(t);
    setLayer(t, turningOn); // UC 0001 step 3: highlight the button straight away
    if (t !== "TAXI_STAND" || !turningOn || taxiStands !== null) return; // load stands once, only when first needed

    try {
      const result = await api.get<TaxiStandDto[]>("/taxi-stands");
      if (result.status === "ok") setTaxiStands(result.response.data.map(toTaxiStand));
    } catch {
      setLayer(t, false); // exception 4a: switch the toggle back…
      setNotice("Unable to load taxi stand markers. Please check your connection."); // …and say why
    }
  }

  const dismissNotice = useCallback(() => setNotice(null), []);

  return (
    <div className="app">
      <MapView taxiStands={active.has("TAXI_STAND") ? (taxiStands ?? []) : []} />
      <FilterTool active={active} onToggle={toggle} />
      {notice && <Toast message={notice} onDismiss={dismissNotice} />}
    </div>
  );
}
