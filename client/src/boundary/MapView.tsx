import type { LatLngTuple } from "leaflet";
import { useCallback, useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { Viewport } from "../entity/Bounds";
import type { Location } from "../entity/Location";
import { STATIC_LAYERS, type StaticLayer } from "../entity/LayerType";
import type { VisibleLayers } from "../control/MapDisplayController";
import { LandmarkDetails } from "./LandmarkDetails";
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
const PLURAL: Record<StaticLayer, string> = {
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

function LayerMarkers({ layer, visible }: { layer: StaticLayer; visible: VisibleLayers }) {
  const map = useMap();
  const { items, clusters } = visible[layer];
  return (
    <>
      {items.map((item) => (
        <Marker key={item.id} position={positionOf(item.location)} icon={markerIcon(layer)} title={item.name}>
          <Popup>
            <LandmarkDetails item={item} />
          </Popup>
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
      {STATIC_LAYERS.map((t) => (
        <LayerMarkers key={t} layer={t} visible={visible} />
      ))}
    </MapContainer>
  );
}
