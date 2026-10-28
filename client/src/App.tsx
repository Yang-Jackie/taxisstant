import { useCallback, useContext, useEffect } from "react";
import { FilterTool } from "./boundary/FilterTool";
import { MapView } from "./boundary/MapView";
import { Toast } from "./boundary/Toast";
import { useStore } from "./boundary/useStore";
import type { Viewport } from "./entity/Bounds";
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
  const onPan = useCallback((viewport: Viewport) => mapDisplay.refreshVisible(viewport), [mapDisplay]);

  // Live layers poll only while the app is on screen (D25)
  useEffect(() => {
    const update = () => mapDisplay.setForeground(document.visibilityState === "visible");
    update();
    document.addEventListener("visibilitychange", update);
    return () => {
      document.removeEventListener("visibilitychange", update);
      mapDisplay.setForeground(false);
    };
  }, [mapDisplay]);

  return (
    <div className="app">
      <MapView visible={display.visible} onPan={onPan} />
      <FilterTool active={preferences.visibleLayers} onToggle={(t) => void mapDisplay.toggleLayer(t)} />
      {display.notice && <Toast message={display.notice} onDismiss={dismissNotice} />}
    </div>
  );
}
