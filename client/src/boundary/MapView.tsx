import type { LatLngTuple } from "leaflet";
import { useCallback, useEffect, type ReactNode } from "react";
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { Viewport } from "../entity/Bounds";
import type { Hotspot } from "../entity/Hotspot";
import type { Landmark } from "../entity/Landmark";
import { STATIC_LAYERS, type LayerType } from "../entity/LayerType";
import type { Locatable } from "../entity/Locatable";
import type { Location } from "../entity/Location";
import type { LayerView } from "../control/LayerClusters";
import type { VisibleLayers } from "../control/MapDisplayController";
import { HotspotDetails, LandmarkDetails } from "./LandmarkDetails";
import { clusterIcon, markerIcon } from "./markerIcons";
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

export interface MapViewProps {
  visible: VisibleLayers;
  /** The design model's MapView.onPan(bounds): told whenever the view moves or zooms (FR-1.5.3). */
  onPan?: (viewport: Viewport) => void;
}

/** Reports the view after every move or zoom, padded so markers just off screen are ready before they scroll in. */
function ViewportReporter({ onPan }: { onPan: (viewport: Viewport) => void }) {
  const map = useMap();
  const report = useCallback(() => {
    const size = map.getSize();
    if (size.x === 0 || size.y === 0) return; // not laid out yet: keep the controller's whole-island view
    const b = map.getBounds().pad(0.25);
    onPan({
      bounds: { south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() },
      zoom: map.getZoom(),
    });
  }, [map, onPan]);
  useMapEvents({ moveend: report, resize: report });
  useEffect(report, [report]);
  return null;
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
        <Marker
          key={keyOf(item, i)}
          position={positionOf(item.getLocation())}
          icon={markerIcon(layer)}
          title={titleOf(item)}
        >
          {popupOf && <Popup>{popupOf(item)}</Popup>}
        </Marker>
      ))}
      {clusters.map((c) => (
        <Marker
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
        <Marker
          key={`flame-${h.id}`}
          position={positionOf(h.centre)}
          icon={markerIcon("HOTSPOT")}
          title={`${h.stationName}: ${busy(h)}`}
        >
          <Popup>
            <HotspotDetails hotspot={h} />
          </Popup>
        </Marker>
      ))}
    </>
  );
}

export function MapView({ visible, onPan }: MapViewProps) {
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
    </MapContainer>
  );
}
