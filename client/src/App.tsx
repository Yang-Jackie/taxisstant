import { useCallback, useContext } from "react";
import { FilterTool } from "./boundary/FilterTool";
import { MapView } from "./boundary/MapView";
import { Toast } from "./boundary/Toast";
import { useStore } from "./boundary/useStore";
import { ControllersContext, type Controllers } from "./startup";
import "./App.css";

function useControllers(): Controllers {
  const controllers = useContext(ControllersContext);
  if (!controllers) throw new Error("<App> must be inside <ControllersContext.Provider>");
  return controllers;
}

export function App() {
  const { settings, mapDisplay } = useControllers();
  const preferences = useStore(settings);
  const display = useStore(mapDisplay);
  const dismissNotice = useCallback(() => mapDisplay.dismissNotice(), [mapDisplay]);

  return (
    <div className="app">
      <MapView taxiStands={display.visible.TAXI_STAND} />
      <FilterTool active={preferences.visibleLayers} onToggle={(t) => void mapDisplay.toggleLayer(t)} />
      {display.notice && <Toast message={display.notice} onDismiss={dismissNotice} />}
    </div>
  );
}
