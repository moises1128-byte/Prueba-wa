'use client';

import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Popup,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { RoutePoint } from '../../domain/route.model';
import styles from './routeLeafletMap.module.css';

const markerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface RouteLeafletMapProps {
  points: readonly RoutePoint[];
}

export function RouteLeafletMap({ points }: RouteLeafletMapProps) {
  const positions = points.map((p) => [p.lat, p.lng] as [number, number]);

  return (
    <MapContainer center={positions[0]} zoom={13} className={styles.map}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
      />
      <Polyline positions={positions} />
      {points.map((point, index) => (
        <Marker key={index} position={[point.lat, point.lng]} icon={markerIcon}>
          <Popup>{point.name ?? `Point ${index + 1}`}</Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
