import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';
import React from 'react';
import { MapContainer, Marker, Polyline, Popup, TileLayer, CircleMarker } from 'react-leaflet';
import { RouteObj, StopPoint } from '../types';

// Fix Leaflet default icon path broken by Vite bundler
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

const STOP_COLOR: Record<string, string> = {
  fountain: '#0ea5e9',
  cafe:     '#f97316',
  repair:   '#8b5cf6',
  bench:    '#22c55e',
};

interface Props {
  origin: [number, number];
  destination: [number, number];
  fastest?: RouteObj;
  pulseroute?: RouteObj;
  activeRoute?: RouteObj;
  stops?: StopPoint[];
  selectedType?: 'fastest' | 'pulseroute';
  height?: string;
}

export function RouteMap({ origin, destination, fastest, pulseroute, activeRoute, stops = [], selectedType = 'pulseroute', height = '380px' }: Props) {
  const midLat = (origin[0] + destination[0]) / 2;
  const midLon = (origin[1] + destination[1]) / 2;

  const startIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
    shadowUrl,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
  });
  const endIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
    shadowUrl,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
  });

  return (
    <div style={{ height }} className="w-full rounded-xl overflow-hidden shadow-md border border-slate-200">
      <MapContainer center={[midLat, midLon]} zoom={14} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Fastest route */}
        {fastest && (
          <Polyline
            positions={fastest.polyline}
            pathOptions={{ color: selectedType === 'fastest' ? '#ef4444' : '#fca5a5', weight: selectedType === 'fastest' ? 5 : 3, opacity: selectedType === 'fastest' ? 1 : 0.5 }}
          />
        )}

        {/* PulseRoute */}
        {pulseroute && (
          <Polyline
            positions={pulseroute.polyline}
            pathOptions={{ color: selectedType === 'pulseroute' ? '#0ea5e9' : '#7dd3fc', weight: selectedType === 'pulseroute' ? 5 : 3, opacity: selectedType === 'pulseroute' ? 1 : 0.5 }}
          />
        )}

        {/* Active ride route */}
        {activeRoute && !fastest && (
          <Polyline
            positions={activeRoute.polyline}
            pathOptions={{ color: activeRoute.type === 'pulseroute' ? '#0ea5e9' : '#ef4444', weight: 5 }}
          />
        )}

        {/* Stops layer */}
        {stops.map((s) => (
          <CircleMarker
            key={s.id}
            center={[s.lat, s.lon]}
            radius={7}
            pathOptions={{ color: STOP_COLOR[s.type] ?? '#64748b', fillColor: STOP_COLOR[s.type] ?? '#64748b', fillOpacity: 0.9, weight: 2 }}
          >
            <Popup>
              <strong>{s.name}</strong><br />
              {s.type === 'fountain' ? '💧 Water Fountain' : s.type === 'cafe' ? '☕ Cafe' : '🔧 Bike Repair'}
              {s.distance_m && <><br />{s.distance_m.toFixed(0)}m off route</>}
            </Popup>
          </CircleMarker>
        ))}

        {/* Water stops on active/pulse route */}
        {(pulseroute ?? activeRoute)?.water_stops.map((s) => (
          <CircleMarker
            key={`ws-${s.id}`}
            center={[s.lat, s.lon]}
            radius={8}
            pathOptions={{ color: '#0ea5e9', fillColor: '#0ea5e9', fillOpacity: 1, weight: 2 }}
          >
            <Popup><strong>{s.name}</strong><br />💧 Water stop on PulseRoute</Popup>
          </CircleMarker>
        ))}

        {/* Origin / destination markers */}
        <Marker position={origin} icon={startIcon}>
          <Popup>📍 Start</Popup>
        </Marker>
        <Marker position={destination} icon={endIcon}>
          <Popup>🏁 Destination</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
