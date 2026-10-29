import { useCallback, useContext, useEffect, useState } from "react";
import { FilterTool } from "./boundary/FilterTool";
import { LocationBanner } from "./boundary/LocationBanner";
import { LocationButton } from "./boundary/LocationButton";
import { MapView } from "./boundary/MapView";
import { MenuButton } from "./boundary/MenuButton";
import { Sidemenu } from "./boundary/Sidemenu";
import { Toast } from "./boundary/Toast";
import { useStore } from "./boundary/useStore";
import type { Viewport } from "./entity/Bounds";
import type { SuggestedSite } from "./entity/SuggestedSite";
import { ControllersContext, type Controllers } from "./startup";
import "./App.css";

function useControllers(): Controllers {
  const controllers = useContext(ControllersContext);
  if (!controllers) throw new Error("<App> must be inside <ControllersContext.Provider>");
  return controllers;
}

export function App() {
  const { settings, mapDisplay, location, recommendations } = useControllers();
  const whereabouts = useStore(location);
  const preferences = useStore(settings);
  const display = useStore(mapDisplay);
  const suggestions = useStore(recommendations);
  const [menuOpen, setMenuOpen] = useState(false);
  const dismissNotice = useCallback(() => mapDisplay.dismissNotice(), [mapDisplay]);
  const onPan = useCallback((viewport: Viewport) => mapDisplay.refreshVisible(viewport), [mapDisplay]);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  // A chosen suggestion is shown on the map (the dialog map), so the menu gets out of the way
  const showSite = useCallback(
    (site: SuggestedSite) => {
      setMenuOpen(false);
      mapDisplay.focusOn(site.centre);
    },
    [mapDisplay],
  );

  // Live layers poll only while the app is on screen (D25)
  useEffect(() => {
    const update = () => {
      const inFront = document.visibilityState === "visible";
      mapDisplay.setForeground(inFront);
      location.setForeground(inFront); // no GPS in the background either
    };
    update();
    document.addEventListener("visibilitychange", update);
    return () => {
      document.removeEventListener("visibilitychange", update);
      mapDisplay.setForeground(false);
      location.setForeground(false);
    };
  }, [mapDisplay, location]);

  return (
    <div className="app">
      <MapView
        visible={display.visible}
        onPan={onPan}
        driver={display.driver}
        focus={display.focus}
        suggestions={suggestions.results}
      />
      <MenuButton onClick={() => setMenuOpen(true)} />
      <LocationButton
        enabled={display.driver !== null}
        highlighted={display.driverOffCentre}
        onClick={() => mapDisplay.centreOnDriver()}
      />
      {whereabouts.status === "denied" && <LocationBanner onRetry={() => location.retry()} />}
      <FilterTool active={preferences.visibleLayers} onToggle={(t) => void mapDisplay.toggleLayer(t)} />
      {menuOpen && (
        <Sidemenu
          active={preferences.activeSuggestions}
          recommendations={suggestions}
          onToggleSuggestion={(k) => void recommendations.toggle(k, !preferences.activeSuggestions.has(k))}
          onSelect={showSite}
          onClose={closeMenu}
        />
      )}
      {display.notice && <Toast message={display.notice} onDismiss={dismissNotice} />}
    </div>
  );
}
