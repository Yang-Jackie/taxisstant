import { Popup as LeafletPopup, point, type DivIcon, type LatLngTuple, type Marker as LeafletMarker } from "leaflet";
import { Fragment, useCallback, useEffect, useMemo, useRef, type ReactNode, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import {
  Circle,
  MapContainer,
  Marker,
  Pane,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
  type MarkerProps,
} from "react-leaflet";
import type { Viewport } from "../entity/Bounds";
import type { Hotspot } from "../entity/Hotspot";
import type { Landmark } from "../entity/Landmark";
import { STATIC_LAYERS, type LayerType } from "../entity/LayerType";
import type { Locatable } from "../entity/Locatable";
import type { Location } from "../entity/Location";
import type { LayerView } from "../control/LayerClusters";
import type { MapFocus, VisibleLayers } from "../control/MapDisplayController";
import type { Recommendation, RecommendationResults } from "../control/RecommendationController";
import { RECOMMENDATION_KINDS, type RecommendationKind } from "../entity/RecommendationKind";
import type { DriverPosition } from "../entity/DriverPosition";
import { bookmarkIdOf } from "../entity/Bookmark";
import type { NavigationTarget } from "../control/NavigationController";
import { HotspotDetails, LandmarkDetails, SuggestionDetails, type PlaceActions } from "./LandmarkDetails";
import type { MapInsets } from "./useMapInsets";
import {
  bookmarkIcon,
  clusterIcon,
  driverIcon,
  highlightIcon,
  markerIcon,
  SUGGESTION_GROUP,
  suggestionIcon,
} from "./markerIcons";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  ONEMAP_ATTRIBUTION,
  ONEMAP_NIGHT_TILE_URL,
  ONEMAP_TILE_URL,
  PANNING_BOUNDS,
  SINGAPORE_CENTRE,
  START_ZOOM,
} from "./onemap";
import "./MapView.css";

/** OpenStreetMap's licence (ODbL) requires this credit wherever its data is shown: here, the Fuel layer (D12). */
export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';

/**
 * Leaflet stacks shapes (400) under markers (600) under popups (700). Three panes go between markers and popups: the
 * driver's bookmarks (D53); over them the suggestions, so that no layer's markers cover a suggested area or its pin
 * (D51); and over those what the driver keeps an eye on, their own dot and a chosen bookmark. The panes take no taps
 * themselves, so the markers under them still do. Their markers' popups go in Leaflet's popup pane: react-leaflet would
 * put them in the markers' own pane, under the markers above.
 */
const BOOKMARK_PANE = { zIndex: 605, pointerEvents: "none" } as const;
const SUGGESTION_PANE = { zIndex: 610, pointerEvents: "none" } as const;
const TOP_PANE = { zIndex: 620, pointerEvents: "none" } as const;

/**
 * One position array per location. react-leaflet moves a marker whenever it gets a new array, and moving a marker
 * moves its open popup, which makes Leaflet pan and report a move: a new array on every render can loop.
 */
const positions = new WeakMap<Location, LatLngTuple>();
function positionOf(location: Location): LatLngTuple {
  let position = positions.get(location);
  if (!position) {
    position = [location.latitude, location.longitude];
    positions.set(location, position);
  }
  return position;
}

/**
 * A Marker whose title (its tooltip, and its name for screen readers) follows the prop. react-leaflet sets a marker's
 * title only when it makes the marker, so a cluster's count, a hotspot's level, a suggestion's place or the driver's
 * "last known position" would otherwise go stale.
 */
function TitledMarker({ title, ...props }: MarkerProps & { title: string }) {
  const ref = useRef<LeafletMarker>(null);
  useMarkerTitle(ref, title);
  return <Marker ref={ref} title={title} {...props} />;
}

/** Keeps a marker's title as `title`, which also changes with the language (FR-2.1.2). */
function useMarkerTitle(ref: RefObject<LeafletMarker | null>, title: string): void {
  useEffect(() => {
    const marker = ref.current;
    if (!marker) return;
    marker.options.title = title; // Leaflet uses it again whenever it replaces the icon
    marker.getElement()?.setAttribute("title", title);
  }, [ref, title]);
}

export interface MapViewProps {
  visible: VisibleLayers;
  /** The design model's MapView.onPan(bounds): told whenever the view moves or zooms (FR-1.5.3). */
  onPan?: (viewport: Viewport) => void;
  /** The driver's dot (UC 0013). */
  driver?: DriverPosition | null;
  /** Where the controller wants the map to go; it goes each time `seq` changes. */
  focus?: MapFocus | null;
  /** The suggested sites, best first per suggestion (UC 0008/0009). */
  suggestions?: RecommendationResults;
  /** With the Bookmarks filter on, every bookmark's landmark, starred (D53). */
  bookmarked?: readonly Landmark[];
  /** What the popups' buttons do: bookmark and navigate (D39). Without them, popups give facts only. */
  actions?: PlaceActions;
  /** A landmark to show highlighted with its details open: a chosen bookmark (UC 0011). */
  highlighted?: Landmark | null;
  /** The highlighted landmark's details were closed. */
  onHighlightClosed?: (l: Landmark) => void;
  /** OneMap's Night map, for dark mode (D44). */
  dark?: boolean;
  /** How far the controls over the map reach in: popups open clear of them. */
  insets?: MapInsets;
}

/** The room a popup keeps from the controls over the map, and from the screen's sides. */
const POPUP_MARGIN = 8;

/**
 * Popups open clear of the controls over the map: the top bar, the location banner, the layer sheet. Leaflet works out
 * a popup's pan while adding it, from its options, which fall back to the class's own; so those are kept up to date.
 */
function PopupClearance({ insets }: { insets: MapInsets }) {
  useEffect(() => {
    LeafletPopup.prototype.options.autoPanPaddingTopLeft = point(POPUP_MARGIN, insets.top + POPUP_MARGIN);
    LeafletPopup.prototype.options.autoPanPaddingBottomRight = point(POPUP_MARGIN, insets.bottom + POPUP_MARGIN);
  }, [insets.top, insets.bottom]);
  return null;
}

/** Reports the view after every move or zoom, padded so markers just off screen are ready before they scroll in. */
function ViewportReporter({ onPan }: { onPan: (viewport: Viewport) => void }) {
  const map = useMap();
  const report = useCallback(() => {
    const size = map.getSize();
    if (size.x === 0 || size.y === 0) return; // not laid out yet: keep the controller's whole-island view
    const screen = map.getBounds();
    const b = screen.pad(0.25);
    onPan({
      bounds: { south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() },
      screen: { south: screen.getSouth(), west: screen.getWest(), north: screen.getNorth(), east: screen.getEast() },
      zoom: map.getZoom(),
    });
  }, [map, onPan]);
  useMapEvents({ moveend: report, resize: report });
  useEffect(report, [report]);
  return null;
}

/** Moves the map when the controller asks: centring on the driver (D31) or on a chosen suggestion (D33). */
function FocusFollower({ focus }: { focus: MapFocus | null }) {
  const map = useMap();
  useEffect(() => {
    if (focus) map.setView([focus.location.latitude, focus.location.longitude], focus.zoom);
  }, [map, focus]);
  return null;
}

/** The mockup's blue dot, with how far off the fix may be; grey when not live (UC 0013 1a). */
function DriverDot({ driver }: { driver: DriverPosition }) {
  const { t } = useTranslation();
  const colour = driver.live ? "#1e6fe0" : "#8a8d93";
  return (
    <>
      <Circle
        pane="overlayPane" // with the other shapes, under the markers: only the dot goes on top
        center={positionOf(driver.location)}
        radius={driver.accuracyM}
        pathOptions={{ weight: 1, color: colour, fillColor: colour, fillOpacity: 0.1 }}
        interactive={false}
      />
      <TitledMarker
        position={positionOf(driver.location)}
        icon={driverIcon(driver.live)}
        title={driver.live ? t("map.you") : t("map.lastKnown")}
        zIndexOffset={1000}
        keyboard={false}
      />
    </>
  );
}

function OsmCredit() {
  const map = useMap();
  useEffect(() => {
    map.attributionControl.addAttribution(OSM_ATTRIBUTION);
    return () => {
      map.attributionControl.removeAttribution(OSM_ATTRIBUTION);
    };
  }, [map]);
  return null;
}

interface PointMarkersProps<T extends Locatable> {
  layer: Exclude<LayerType, "HOTSPOT">;
  view: LayerView<T>;
  keyOf: (item: T, index: number) => string;
  titleOf: (item: T) => string;
  popupOf?: (item: T) => ReactNode;
}

/**
 * A popup whose content is the same object until what it shows changes. react-leaflet updates an open popup whenever
 * its content changes, and Leaflet pans the map to fit a popup on every update: content made afresh on every render
 * panned on every pan and poll, and near the map's edge (which it can't pan past) for ever.
 */
function StablePopup({ content }: { content: ReactNode }) {
  // No other props: Leaflet takes an option given as undefined (autoPan={undefined}) as switched off
  return <Popup pane="popupPane">{content}</Popup>;
}

/** One landmark's marker, with its details made only when the landmark or what its popup can do changes. */
function PointMarker<T extends Locatable>({
  item,
  icon,
  title,
  popupOf,
}: {
  item: T;
  icon: DivIcon;
  title: string;
  popupOf?: (item: T) => ReactNode;
}) {
  const content = useMemo(() => popupOf?.(item), [popupOf, item]);
  return (
    <TitledMarker position={positionOf(item.getLocation())} icon={icon} title={title}>
      {content && <StablePopup content={content} />}
    </TitledMarker>
  );
}

/** One layer's markers and cluster bubbles; tapping a bubble zooms to where it splits (D17). */
function PointMarkers<T extends Locatable>({ layer, view, keyOf, titleOf, popupOf }: PointMarkersProps<T>) {
  const { t } = useTranslation();
  const map = useMap();
  const { items, clusters } = view;
  return (
    <>
      {items.map((item, i) => (
        <PointMarker
          key={keyOf(item, i)}
          item={item}
          icon={markerIcon(layer)}
          title={titleOf(item)}
          popupOf={popupOf}
        />
      ))}
      {clusters.map((c) => (
        <TitledMarker
          key={`cluster-${c.id}`}
          position={positionOf(c.location)}
          icon={clusterIcon(layer, c.count)}
          title={t(`map.cluster.${layer}`, { count: c.count })}
          eventHandlers={{ click: () => map.setView([c.location.latitude, c.location.longitude], c.zoomTo) }}
        />
      ))}
    </>
  );
}

/**
 * A chosen bookmark's landmark, ringed and above everything else, with its details open, whether or not its layer is
 * on or clustered (UC 0011 steps 3–4). Closing the details ends the highlight.
 */
function HighlightedLandmark({
  landmark,
  actions,
  onClosed,
}: {
  landmark: Landmark;
  actions?: PlaceActions;
  onClosed?: (l: Landmark) => void;
}) {
  const { t } = useTranslation();
  const title = t("map.highlighted", { name: landmark.name });
  const ref = useRef<LeafletMarker>(null);
  useMarkerTitle(ref, title);
  useEffect(() => {
    ref.current?.openPopup();
  }, []);
  return (
    <Marker
      ref={ref}
      position={positionOf(landmark.location)}
      icon={highlightIcon(landmark.getType())}
      title={title}
      zIndexOffset={2000}
      eventHandlers={{ popupclose: () => onClosed?.(landmark) }}
    >
      {/* No auto-pan: the map is already moving to centre the landmark, and Leaflet's auto-pan would stop that */}
      <Popup pane="popupPane" autoPan={false}>
        <LandmarkDetails item={landmark} actions={actions} />
      </Popup>
    </Marker>
  );
}

/** A busy station's flame, with its details made only when the hotspot changes. */
function HotspotFlame({ hotspot, onNavigate }: { hotspot: Hotspot; onNavigate?: (t: NavigationTarget) => void }) {
  const { t } = useTranslation();
  const content = useMemo(() => <HotspotDetails hotspot={hotspot} onNavigate={onNavigate} />, [hotspot, onNavigate]);
  return (
    <TitledMarker
      position={positionOf(hotspot.centre)}
      icon={markerIcon("HOTSPOT")}
      title={t(`map.hotspot.${hotspot.density}`, { station: hotspot.stationName })}
    >
      <StablePopup content={content} />
    </TitledMarker>
  );
}

/** The mockup's heat circles: amber, larger and stronger for very crowded stations (D23), with a flame to tap. */
function HotspotCircles({
  hotspots,
  onNavigate,
}: {
  hotspots: readonly Hotspot[];
  onNavigate?: (t: NavigationTarget) => void;
}) {
  return (
    <>
      {hotspots.map((h) => (
        <Circle
          key={h.id}
          center={positionOf(h.centre)}
          radius={h.radius}
          pathOptions={{ weight: 0, fillColor: "#e8930c", fillOpacity: h.density === "HIGH" ? 0.35 : 0.2 }}
        />
      ))}
      {hotspots.map((h) => (
        <HotspotFlame key={`flame-${h.id}`} hotspot={h} onNavigate={onNavigate} />
      ))}
    </>
  );
}

const SUGGESTION_COLOUR = { find: "#e8930c", rest: "#0e7a57" } as const;

/** A suggested site's numbered pin, with its details made only when the ranking changes. */
function SuggestionPin({
  kind,
  place,
  recommendation,
  onNavigate,
}: {
  kind: RecommendationKind;
  place: number;
  recommendation: Recommendation;
  onNavigate?: (t: NavigationTarget) => void;
}) {
  const { t } = useTranslation();
  const content = useMemo(
    () => <SuggestionDetails recommendation={recommendation} onNavigate={onNavigate} />,
    [recommendation, onNavigate],
  );
  return (
    <TitledMarker
      position={positionOf(recommendation.site.centre)}
      icon={suggestionIcon(kind, place)}
      title={t(`map.suggestionPin.${kind}`, { place, name: recommendation.site.name })}
    >
      <StablePopup content={content} />
    </TitledMarker>
  );
}

/**
 * Each suggested site's area, outlined in its suggestion's colour, with a numbered pin to tap (D33). The outline goes
 * over the layers' markers and the light fill under them, so that it doesn't dim them (D51).
 */
function SuggestionAreas({
  suggestions,
  onNavigate,
}: {
  suggestions: RecommendationResults;
  onNavigate?: (t: NavigationTarget) => void;
}) {
  return (
    <>
      {RECOMMENDATION_KINDS.flatMap((k) =>
        suggestions[k].map(({ site }) => {
          const colour = SUGGESTION_COLOUR[SUGGESTION_GROUP[k]];
          return (
            <Fragment key={`area-${k}-${site.id}`}>
              <Circle
                pane="overlayPane"
                center={positionOf(site.centre)}
                radius={site.radius}
                pathOptions={{ stroke: false, fillColor: colour, fillOpacity: 0.08 }}
                interactive={false}
              />
              <Circle
                center={positionOf(site.centre)}
                radius={site.radius}
                pathOptions={{ weight: 2, color: colour, dashArray: "6 6", fill: false }}
                interactive={false}
              />
            </Fragment>
          );
        }),
      )}
      {RECOMMENDATION_KINDS.flatMap((k) =>
        suggestions[k].map((r, i) => (
          <SuggestionPin
            key={`pin-${k}-${r.site.id}`}
            kind={k}
            place={i + 1}
            recommendation={r}
            onNavigate={onNavigate}
          />
        )),
      )}
    </>
  );
}

const NO_SUGGESTIONS: RecommendationResults = { PICKUP: [], REST_STOP: [] };
const NO_LANDMARKS: readonly Landmark[] = [];
const NO_INSETS: MapInsets = { top: 0, bottom: 0 };

export function MapView({
  visible,
  onPan,
  driver = null,
  focus = null,
  suggestions = NO_SUGGESTIONS,
  bookmarked = NO_LANDMARKS,
  actions,
  highlighted = null,
  onHighlightClosed,
  dark = false,
  insets = NO_INSETS,
}: MapViewProps) {
  const { t } = useTranslation();
  const landmarkPopup = useCallback((item: Landmark) => <LandmarkDetails item={item} actions={actions} />, [actions]);
  const fuelShown = visible.FUEL.items.length > 0 || visible.FUEL.clusters.length > 0;
  return (
    <MapContainer
      className="map-view"
      center={SINGAPORE_CENTRE}
      zoom={START_ZOOM}
      minZoom={MIN_ZOOM}
      maxZoom={MAX_ZOOM}
      maxBounds={PANNING_BOUNDS}
    >
      <TileLayer url={dark ? ONEMAP_NIGHT_TILE_URL : ONEMAP_TILE_URL} attribution={ONEMAP_ATTRIBUTION} />
      {onPan && <ViewportReporter onPan={onPan} />}
      <FocusFollower focus={focus} />
      <PopupClearance insets={insets} />
      {fuelShown && <OsmCredit />}
      <HotspotCircles hotspots={visible.HOTSPOT.items} onNavigate={actions?.onNavigate} />
      {STATIC_LAYERS.map((t) => (
        <PointMarkers<Landmark>
          key={t}
          layer={t}
          view={visible[t]}
          keyOf={(item) => item.id}
          titleOf={(item) => item.name}
          popupOf={landmarkPopup}
        />
      ))}
      <PointMarkers layer="TAXIS" view={visible.TAXIS} keyOf={(_, i) => String(i)} titleOf={() => t("map.taxi")} />
      {/* Every bookmark, starred, whatever layers are on and never in a cluster (D53) */}
      <Pane name="bookmarks" style={BOOKMARK_PANE}>
        {bookmarked.map((l) => (
          <PointMarker
            key={bookmarkIdOf(l)}
            item={l}
            icon={bookmarkIcon(l.getType())}
            title={t("map.bookmarked", { name: l.name })}
            popupOf={landmarkPopup}
          />
        ))}
      </Pane>
      <Pane name="suggestions" style={SUGGESTION_PANE}>
        <SuggestionAreas suggestions={suggestions} onNavigate={actions?.onNavigate} />
      </Pane>
      <Pane name="top" style={TOP_PANE}>
        {highlighted && (
          <HighlightedLandmark
            key={bookmarkIdOf(highlighted)}
            landmark={highlighted}
            actions={actions}
            onClosed={onHighlightClosed}
          />
        )}
        {driver && <DriverDot driver={driver} />}
      </Pane>
    </MapContainer>
  );
}
