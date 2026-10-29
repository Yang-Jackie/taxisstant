import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { FilterTool } from "./boundary/FilterTool";
import type { PlaceActions } from "./boundary/LandmarkDetails";
import { LocationBanner } from "./boundary/LocationBanner";
import { LocationButton } from "./boundary/LocationButton";
import { MapView } from "./boundary/MapView";
import { MenuButton } from "./boundary/MenuButton";
import { NavigationPrompt } from "./boundary/NavigationPrompt";
import { Sidemenu } from "./boundary/Sidemenu";
import { Toast } from "./boundary/Toast";
import { useStore } from "./boundary/useStore";
import type { Bookmark } from "./entity/Bookmark";
import type { Viewport } from "./entity/Bounds";
import type { Landmark } from "./entity/Landmark";
import type { SuggestedSite } from "./entity/SuggestedSite";
import { ControllersContext, type Controllers } from "./startup";
import "./App.css";

function useControllers(): Controllers {
  const controllers = useContext(ControllersContext);
  if (!controllers) throw new Error("<App> must be inside <ControllersContext.Provider>");
  return controllers;
}

export function App() {
  const { settings, mapDisplay, location, recommendations, bookmarks, navigation } = useControllers();
  const whereabouts = useStore(location);
  const preferences = useStore(settings);
  const display = useStore(mapDisplay);
  const suggestions = useStore(recommendations);
  const saved = useStore(bookmarks);
  const route = useStore(navigation);
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
  // What a place's popup can do: its star and Navigate (D39)
  const actions = useMemo<PlaceActions>(
    () => ({
      bookmarked: saved.ids,
      onToggleBookmark: (l) => void bookmarks.toggleBookmark(l),
      onNavigate: (target) => navigation.navigateTo(target),
    }),
    [saved.ids, bookmarks, navigation],
  );
  // A chosen bookmark is shown highlighted on the map (UC 0011), so the menu gets out of the way too
  const showBookmark = useCallback(
    (b: Bookmark) => {
      setMenuOpen(false);
      void bookmarks.openBookmark(b.id);
    },
    [bookmarks],
  );
  const endHighlight = useCallback((l: Landmark) => mapDisplay.clearHighlight(l), [mapDisplay]);
  const answerNavigation = useCallback(
    (ok: boolean, doNotShow: boolean) => navigation.confirm(ok, doNotShow),
    [navigation],
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
        actions={actions}
        highlighted={display.highlighted}
        onHighlightClosed={endHighlight}
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
          onNavigate={actions.onNavigate}
          bookmarks={saved.bookmarks}
          driverAt={whereabouts.position?.location}
          onSelectBookmark={showBookmark}
          onClose={closeMenu}
        />
      )}
      {route.pending && <NavigationPrompt target={route.pending} onAnswer={answerNavigation} />}
      {display.notice && <Toast message={display.notice} onDismiss={dismissNotice} />}
    </div>
  );
}
