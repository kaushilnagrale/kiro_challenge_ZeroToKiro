// Web version — map stub (react-native-maps doesn't support web)
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
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

const STOP_EMOJI: Record<string, string> = {
  fountain: '💧',
  cafe:     '☕',
  repair:   '🔧',
  bench:    '🪑',
};

export function RouteMap({ fastest, pulseroute, activeRoute, stops = [], selectedType = 'pulseroute', height = 260 }: Props) {
  const pulse = pulseroute ?? activeRoute;
  const fast  = fastest;

  return (
    <View style={[styles.container, { height }]}>
      {/* Route summary cards */}
      <View style={styles.row}>
        {fast && (
          <View style={[styles.routeBox, selectedType === 'fastest' && styles.routeBoxActive, styles.fastBox]}>
            <Text style={styles.routeLabel}>⚡ Fastest</Text>
            <Text style={styles.routeStat}>{(fast.distance_m / 1000).toFixed(1)} km</Text>
            <Text style={styles.routeMrt}>🌡️ {fast.peak_mrt_c}°C MRT</Text>
            <Text style={styles.routeShade}>🌿 {fast.shade_pct}% shade</Text>
          </View>
        )}
        {pulse && (
          <View style={[styles.routeBox, selectedType === 'pulseroute' && styles.routeBoxActive, styles.pulseBox]}>
            <Text style={styles.routeLabel}>🌊 PulseRoute</Text>
            <Text style={styles.routeStat}>{(pulse.distance_m / 1000).toFixed(1)} km</Text>
            <Text style={styles.routeMrt}>🌡️ {pulse.peak_mrt_c}°C MRT</Text>
            <Text style={styles.routeShade}>🌿 {pulse.shade_pct}% shade</Text>
            {pulse.water_stops.length > 0 && (
              <Text style={styles.routeStops}>💧 {pulse.water_stops.length} water stops</Text>
            )}
          </View>
        )}
      </View>

      {/* Stops list */}
      {stops.length > 0 && (
        <View style={styles.stopsRow}>
          {stops.slice(0, 5).map((s) => (
            <View key={s.id} style={styles.stopChip}>
              <Text style={styles.stopChipText}>{STOP_EMOJI[s.type] ?? '📍'} {s.name}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.webNote}>🗺️ Interactive map available in Expo Go (iOS/Android)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#dbeafe',
    width: '100%',
    padding: 12,
    justifyContent: 'center',
  },
  row:              { flexDirection: 'row', gap: 8, marginBottom: 8 },
  routeBox:         {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  routeBoxActive:   { borderWidth: 2.5 },
  fastBox:          { borderColor: '#ef4444' },
  pulseBox:         { borderColor: '#0ea5e9' },
  routeLabel:       { fontWeight: '700', fontSize: 13, marginBottom: 4 },
  routeStat:        { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  routeMrt:         { fontSize: 12, color: '#475569', marginTop: 2 },
  routeShade:       { fontSize: 12, color: '#475569' },
  routeStops:       { fontSize: 12, color: '#0369a1', fontWeight: '600' },
  stopsRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 6 },
  stopChip:         {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  stopChipText:     { fontSize: 11, color: '#1e40af' },
  webNote:          { fontSize: 11, color: '#1e40af', textAlign: 'center', fontStyle: 'italic' },
});
