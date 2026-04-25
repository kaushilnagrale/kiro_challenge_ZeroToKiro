// Native version — real react-native-maps
import React from 'react';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { StyleSheet } from 'react-native';
import { RouteObj, StopPoint, Coordinate } from '../types';

interface Props {
  origin: Coordinate;
  destination: Coordinate;
  fastest?: RouteObj;
  pulseroute?: RouteObj;
  activeRoute?: RouteObj;
  stops?: StopPoint[];
  selectedType?: 'fastest' | 'pulseroute';
  height?: number;
}

const STOP_COLORS: Record<string, string> = {
  fountain: '#0ea5e9',
  cafe:     '#f97316',
  repair:   '#8b5cf6',
  bench:    '#22c55e',
};

export function RouteMap({ origin, destination, fastest, pulseroute, activeRoute, stops = [], selectedType = 'pulseroute', height = 260 }: Props) {
  const midLat = (origin.latitude + destination.latitude) / 2;
  const midLon = (origin.longitude + destination.longitude) / 2;
  const latDelta = Math.abs(origin.latitude - destination.latitude) * 1.6 + 0.01;
  const lonDelta = Math.abs(origin.longitude - destination.longitude) * 1.6 + 0.01;

  const toCoords = (poly: [number, number][]) =>
    poly.map(([lat, lon]) => ({ latitude: lat, longitude: lon }));

  const route = activeRoute ?? pulseroute ?? fastest;

  return (
    <MapView
      style={[styles.map, { height }]}
      provider={PROVIDER_DEFAULT}
      initialRegion={{ latitude: midLat, longitude: midLon, latitudeDelta: latDelta, longitudeDelta: lonDelta }}
    >
      {fastest && (
        <Polyline
          coordinates={toCoords(fastest.polyline)}
          strokeColor={selectedType === 'fastest' ? '#ef4444' : '#fca5a5'}
          strokeWidth={selectedType === 'fastest' ? 5 : 3}
        />
      )}
      {pulseroute && (
        <Polyline
          coordinates={toCoords(pulseroute.polyline)}
          strokeColor={selectedType === 'pulseroute' ? '#0ea5e9' : '#7dd3fc'}
          strokeWidth={selectedType === 'pulseroute' ? 5 : 3}
        />
      )}
      {activeRoute && !fastest && (
        <Polyline
          coordinates={toCoords(activeRoute.polyline)}
          strokeColor={activeRoute.type === 'pulseroute' ? '#0ea5e9' : '#ef4444'}
          strokeWidth={5}
        />
      )}
      <Marker coordinate={origin} title="Start" pinColor="green" />
      <Marker coordinate={destination} title="Destination" pinColor="red" />
      {stops.map((s) => (
        <Marker
          key={s.id}
          coordinate={{ latitude: s.lat, longitude: s.lon }}
          title={s.name}
          pinColor={STOP_COLORS[s.type] ?? '#0ea5e9'}
        />
      ))}
      {route?.water_stops.map((s) => (
        <Marker
          key={s.id}
          coordinate={{ latitude: s.lat, longitude: s.lon }}
          title={s.name}
          pinColor="#0ea5e9"
        />
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { width: '100%' },
});
