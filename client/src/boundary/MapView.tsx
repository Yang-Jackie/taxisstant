import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import type { TaxiStand } from "../entity/TaxiStand";
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

export interface MapViewProps {
  taxiStands: readonly TaxiStand[];
}

export function MapView({ taxiStands }: MapViewProps) {
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
      {taxiStands.map((stand) => (
        <Marker key={stand.id} position={[stand.location.latitude, stand.location.longitude]} title={stand.name}>
          <Popup>{stand.name}</Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
