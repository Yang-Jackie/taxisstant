import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FilterTool } from "./boundary/FilterTool";
import { HelpView } from "./boundary/HelpView";
import { HTML_LANG, i18next, LOCALE } from "./boundary/i18n";
import type { PlaceActions } from "./boundary/LandmarkDetails";
import { LanguageButton } from "./boundary/LanguageButton";
import { LanguageView } from "./boundary/LanguageView";
import { LocationBanner } from "./boundary/LocationBanner";
import { LocationButton } from "./boundary/LocationButton";
import { MapView } from "./boundary/MapView";
import { MenuButton } from "./boundary/MenuButton";
import { NavigationPrompt } from "./boundary/NavigationPrompt";
import { SettingsView } from "./boundary/SettingsView";
import { Sidemenu } from "./boundary/Sidemenu";
import { Toast } from "./boundary/Toast";
import { useMapInsets } from "./boundary/useMapInsets";
import { useStore } from "./boundary/useStore";
import type { Bookmark } from "./entity/Bookmark";
import type { Viewport } from "./entity/Bounds";
import type { Landmark } from "./entity/Landmark";
import { LAYER_TYPES } from "./entity/LayerType";
import { hiddenEnergyLayer } from "./entity/UserPreferences";
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
  // The drawer's screens, as in the dialog map: the side menu, and Settings reached from it
  const [panel, setPanel] = useState<"menu" | "settings" | "language" | "help" | null>(null);
  const { t } = useTranslation();
  const appRef = useRef<HTMLDivElement>(null);
  const insets = useMapInsets(appRef); // popups open clear of the controls over the map
  const dismissNotice = useCallback(() => mapDisplay.dismissNotice(), [mapDisplay]);
  const onPan = useCallback((viewport: Viewport) => mapDisplay.refreshVisible(viewport), [mapDisplay]);
  const closeMenu = useCallback(() => setPanel(null), []);
  // A chosen suggestion is shown on the map (the dialog map), so the menu gets out of the way
  const showSite = useCallback(
    (site: SuggestedSite) => {
      setPanel(null);
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
      setPanel(null);
      void bookmarks.openBookmark(b.id);
    },
    [bookmarks],
  );
  const endHighlight = useCallback((l: Landmark) => mapDisplay.clearHighlight(l), [mapDisplay]);
  const answerNavigation = useCallback(
    (ok: boolean, doNotShow: boolean) => navigation.confirm(ok, doNotShow),
    [navigation],
  );

  // The driver's language, for every word on screen and for screen readers (FR-2.1.2)
  useEffect(() => {
    void i18next.changeLanguage(LOCALE[preferences.language]);
    document.documentElement.lang = HTML_LANG[preferences.language];
  }, [preferences.language]);

  // Text size and dark mode apply to the whole page: rem-based text scales with the root (FR-2, D44)
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = preferences.darkMode ? "dark" : "light";
    root.style.fontSize = `${preferences.fontSize}%`;
  }, [preferences.darkMode, preferences.fontSize]);

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
    <div className="app" ref={appRef}>
      <MapView
        visible={display.visible}
        onPan={onPan}
        driver={display.driver}
        focus={display.focus}
        suggestions={suggestions.results}
        actions={actions}
        highlighted={display.highlighted}
        onHighlightClosed={endHighlight}
        dark={preferences.darkMode}
        insets={insets}
      />
      <MenuButton onClick={() => setPanel("menu")} />
      <LanguageButton language={preferences.language} onChange={(l) => void settings.setLanguage(l)} />
      {whereabouts.status === "denied" && <LocationBanner onRetry={() => location.retry()} />}
      <div className="map-tools" data-map-overlay="bottom">
        <LocationButton
          enabled={display.driver !== null}
          highlighted={display.driverOffCentre}
          onClick={() => mapDisplay.centreOnDriver()}
        />
        <FilterTool
          active={preferences.visibleLayers}
          onToggle={(t) => void mapDisplay.toggleLayer(t)}
          layers={LAYER_TYPES.filter((t) => t !== hiddenEnergyLayer(preferences.vehicleType))}
          loading={display.loading}
        />
      </div>
      {panel === "menu" && (
        <Sidemenu
          active={preferences.activeSuggestions}
          recommendations={suggestions}
          onToggleSuggestion={(k) => void recommendations.toggle(k, !preferences.activeSuggestions.has(k))}
          onSelect={showSite}
          onNavigate={actions.onNavigate}
          bookmarks={saved.bookmarks}
          driverAt={whereabouts.position?.location}
          onSelectBookmark={showBookmark}
          onOpenLanguage={() => setPanel("language")}
          onOpenSettings={() => setPanel("settings")}
          onOpenHelp={() => setPanel("help")}
          onClose={closeMenu}
        />
      )}
      {panel === "settings" && (
        <SettingsView
          preferences={preferences}
          onSetLanguage={(l) => void settings.setLanguage(l)}
          onSetVehicleType={(v) => void settings.setVehicleType(v)}
          onSetDisplay={(fontSize, darkMode) => void settings.setDisplay(fontSize, darkMode)}
          onSetSkipNavPrompt={(skip) => void settings.setSkipNavPrompt(skip)}
          onBack={() => setPanel("menu")}
          onClose={closeMenu}
        />
      )}
      {route.pending && <NavigationPrompt target={route.pending} onAnswer={answerNavigation} />}
      {panel === "language" && (
        <LanguageView
          language={preferences.language}
          onChange={(l) => void settings.setLanguage(l)}
          onBack={() => setPanel("menu")}
          onClose={closeMenu}
        />
      )}
      {panel === "help" && <HelpView onBack={() => setPanel("menu")} onClose={closeMenu} />}
      {display.notice && <Toast message={t(`toast.${display.notice}`)} onDismiss={dismissNotice} />}
    </div>
  );
}
