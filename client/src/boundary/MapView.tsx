import type { LatLngTuple, Marker as LeafletMarker } from "leaflet";
import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents, type MarkerProps } from "react-leaflet";
import type { Viewport } from "../entity/Bounds";
import type { Hotspot } from "../entity/Hotspot";
import type { Landmark } from "../entity/Landmark";
import { STATIC_LAYERS, type LayerType } from "../entity/LayerType";
import type { Locatable } from "../entity/Locatable";
import type { Location } from "../entity/Location";
import type { LayerView } from "../control/LayerClusters";
import type { MapFocus, VisibleLayers } from "../control/MapDisplayController";
import type { RecommendationResults } from "../control/RecommendationController";
import { RECOMMENDATION_KINDS } from "../entity/RecommendationKind";
import type { DriverPosition } from "../entity/DriverPosition";
import { HotspotDetails, LandmarkDetails, SuggestionDetails } from "./LandmarkDetails";
import { clusterIcon, driverIcon, markerIcon, SUGGESTION_GROUP, suggestionIcon } from "./markerIcons";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  ONEMAP_ATTRIBUTION,
  ONEMAP_TILE_URL,
  SINGAPORE_BOUNDS,
  SINGAPORE_CENTRE,
  START_ZOOM,
} from "./onemap";
import "./MapView.css";

/** OpenStreetMap's licence (ODbL) requires this credit wherever its data is shown: here, the Fuel layer (D12). */
export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';

/** How each layer's markers are described when grouped. */
const PLURAL: Record<Exclude<LayerType, "HOTSPOT">, string> = {
  TAXIS: "available taxis",
  TAXI_STAND: "taxi stands",
  CARPARK: "carparks",
  FUEL: "fuel stations",
  CHARGING: "charging places",
  HAWKER: "hawker centres",
};

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
  useEffect(() => {
    const marker = ref.current;
    if (!marker) return;
    marker.options.title = title; // Leaflet uses it again whenever it replaces the icon
    marker.getElement()?.setAttribute("title", title);
  }, [title]);
  return <Marker ref={ref} title={title} {...props} />;
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
  const colour = driver.live ? "#1e6fe0" : "#8a8d93";
  return (
    <>
      <Circle
        center={positionOf(driver.location)}
        radius={driver.accuracyM}
        pathOptions={{ weight: 1, color: colour, fillColor: colour, fillOpacity: 0.1 }}
        interactive={false}
      />
      <TitledMarker
        position={positionOf(driver.location)}
        icon={driverIcon(driver.live)}
        title={driver.live ? "You are here" : "Your last known position"}
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

/** One layer's markers and cluster bubbles; tapping a bubble zooms to where it splits (D17). */
function PointMarkers<T extends Locatable>({ layer, view, keyOf, titleOf, popupOf }: PointMarkersProps<T>) {
  const map = useMap();
  const { items, clusters } = view;
  return (
    <>
      {items.map((item, i) => (
        <TitledMarker
          key={keyOf(item, i)}
          position={positionOf(item.getLocation())}
          icon={markerIcon(layer)}
          title={titleOf(item)}
        >
          {popupOf && <Popup>{popupOf(item)}</Popup>}
        </TitledMarker>
      ))}
      {clusters.map((c) => (
        <TitledMarker
          key={`cluster-${c.id}`}
          position={positionOf(c.location)}
          icon={clusterIcon(layer, c.count)}
          title={`${c.count} ${PLURAL[layer]}: tap to zoom in`}
          eventHandlers={{ click: () => map.setView([c.location.latitude, c.location.longitude], c.zoomTo) }}
        />
      ))}
    </>
  );
}

/** The mockup's heat circles: amber, larger and stronger for very crowded stations (D23), with a flame to tap. */
function HotspotCircles({ hotspots }: { hotspots: readonly Hotspot[] }) {
  const busy = (h: Hotspot) => (h.density === "HIGH" ? "very crowded" : "crowded");
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
        <TitledMarker
          key={`flame-${h.id}`}
          position={positionOf(h.centre)}
          icon={markerIcon("HOTSPOT")}
          title={`${h.stationName}: ${busy(h)}`}
        >
          <Popup>
            <HotspotDetails hotspot={h} />
          </Popup>
        </TitledMarker>
      ))}
    </>
  );
}

const SUGGESTION_COLOUR = { find: "#e8930c", rest: "#0e7a57" } as const;
const SUGGESTION_NAME = { PICKUP: "Suggested pickup", REST_STOP: "Suggested rest stop" } as const;

/** Each suggested site's area, outlined in its suggestion's colour, with a numbered pin to tap (D33). */
function SuggestionAreas({ suggestions }: { suggestions: RecommendationResults }) {
  return (
    <>
      {RECOMMENDATION_KINDS.flatMap((k) =>
        suggestions[k].map(({ site }) => (
          <Circle
            key={`area-${k}-${site.id}`}
            center={positionOf(site.centre)}
            radius={site.radius}
            pathOptions={{
              weight: 2,
              color: SUGGESTION_COLOUR[SUGGESTION_GROUP[k]],
              dashArray: "6 6",
              fillOpacity: 0.08,
            }}
            interactive={false}
          />
        )),
      )}
      {RECOMMENDATION_KINDS.flatMap((k) =>
        suggestions[k].map((r, i) => (
          <TitledMarker
            key={`pin-${k}-${r.site.id}`}
            position={positionOf(r.site.centre)}
            icon={suggestionIcon(k, i + 1)}
            title={`${SUGGESTION_NAME[k]} ${i + 1}: ${r.site.name}`}
            zIndexOffset={500}
          >
            <Popup>
              <SuggestionDetails recommendation={r} />
            </Popup>
          </TitledMarker>
        )),
      )}
    </>
  );
}

const NO_SUGGESTIONS: RecommendationResults = { PICKUP: [], REST_STOP: [] };

export function MapView({ visible, onPan, driver = null, focus = null, suggestions = NO_SUGGESTIONS }: MapViewProps) {
  const fuelShown = visible.FUEL.items.length > 0 || visible.FUEL.clusters.length > 0;
  return (
    <MapContainer
      className="map-view"
      center={SINGAPORE_CENTRE}
      zoom={START_ZOOM}
      minZoom={MIN_ZOOM}
      maxZoom={MAX_ZOOM}
      maxBounds={SINGAPORE_BOUNDS}
    >
      <TileLayer url={ONEMAP_TILE_URL} attribution={ONEMAP_ATTRIBUTION} />
      {onPan && <ViewportReporter onPan={onPan} />}
      <FocusFollower focus={focus} />
      {fuelShown && <OsmCredit />}
      <HotspotCircles hotspots={visible.HOTSPOT.items} />
      {STATIC_LAYERS.map((t) => (
        <PointMarkers<Landmark>
          key={t}
          layer={t}
          view={visible[t]}
          keyOf={(item) => item.id}
          titleOf={(item) => item.name}
          popupOf={(item) => <LandmarkDetails item={item} />}
        />
      ))}
      <PointMarkers layer="TAXIS" view={visible.TAXIS} keyOf={(_, i) => String(i)} titleOf={() => "Available taxi"} />
      <SuggestionAreas suggestions={suggestions} />
      {driver && <DriverDot driver={driver} />}
    </MapContainer>
  );
}
