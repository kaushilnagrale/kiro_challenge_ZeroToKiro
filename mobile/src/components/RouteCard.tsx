import React from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RouteObj } from '../types';

interface Props {
  route: RouteObj;
  isSelected: boolean;
  onSelect: () => void;
  onWhyTap?: () => void;
}

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 48;

function fmtDist(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
}

function fmtTime(s: number) {
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}min`;
}

export function RouteCard({ route, isSelected, onSelect, onWhyTap }: Props) {
  const isPulse = route.type === 'pulseroute';

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onSelect}
      style={[
        styles.card,
        isSelected && (isPulse ? styles.cardSelectedPulse : styles.cardSelectedFast),
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.badge, isPulse ? styles.badgePulse : styles.badgeFast]}>
          <Text style={styles.badgeText}>
            {isPulse ? '🌊 PulseRoute' : '⚡ Fastest'}
          </Text>
        </View>
        {isSelected && (
          <View style={styles.selectedDot} />
        )}
      </View>

      {/* Primary metrics */}
      <View style={styles.metricsRow}>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{fmtDist(route.distance_m)}</Text>
          <Text style={styles.metricLabel}>distance</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{fmtTime(route.duration_s)}</Text>
          <Text style={styles.metricLabel}>ETA</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metric}>
          <Text style={[
            styles.metricValue,
            { color: route.peak_mrt_c > 50 ? '#ef4444' : route.peak_mrt_c > 40 ? '#f97316' : '#22c55e' }
          ]}>
            {route.peak_mrt_c}°C
          </Text>
          <Text style={styles.metricLabel}>peak MRT</Text>
        </View>
      </View>

      {/* Secondary stats */}
      <View style={styles.statsRow}>
        <Text style={styles.stat}>🌿 {route.shade_pct}% shade</Text>
        <Text style={styles.stat}>💧 {route.water_stops.length} water stops</Text>
        {isPulse && route.mrt_differential != null && (
          <Text style={[styles.stat, styles.statGood]}>
            −{route.mrt_differential.toFixed(1)}°C vs fastest
          </Text>
        )}
      </View>

      {/* Water stops list */}
      {route.water_stops.length > 0 && (
        <View style={styles.stopsList}>
          {route.water_stops.slice(0, 2).map((stop) => (
            <Text key={stop.id} style={styles.stopItem}>
              💧 {stop.name}{stop.distance_m ? ` — ${stop.distance_m.toFixed(0)}m off route` : ''}
            </Text>
          ))}
        </View>
      )}

      {/* Why this route? */}
      {isPulse && onWhyTap && (
        <TouchableOpacity onPress={onWhyTap} style={styles.whyBtn}>
          <Text style={styles.whyBtnText}>Why this route? →</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardSelectedPulse: { borderColor: '#0ea5e9', shadowColor: '#0ea5e9', shadowOpacity: 0.2 },
  cardSelectedFast:  { borderColor: '#ef4444', shadowColor: '#ef4444', shadowOpacity: 0.2 },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  badge:        { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  badgePulse:   { backgroundColor: '#e0f2fe' },
  badgeFast:    { backgroundColor: '#fee2e2' },
  badgeText:    { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  selectedDot:  { width: 10, height: 10, borderRadius: 5, backgroundColor: '#0369a1' },
  metricsRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  metric:       { flex: 1, alignItems: 'center' },
  metricValue:  { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  metricLabel:  { fontSize: 11, color: '#64748b', marginTop: 2 },
  metricDivider: { width: 1, height: 32, backgroundColor: '#e2e8f0' },
  statsRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  stat:         {
    fontSize: 12,
    color: '#475569',
    backgroundColor: '#f1f5f9',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  statGood:     { backgroundColor: '#dcfce7', color: '#166534' },
  stopsList:    { marginTop: 6, gap: 3 },
  stopItem:     { fontSize: 12, color: '#0369a1' },
  whyBtn:       { marginTop: 10, alignSelf: 'flex-start' },
  whyBtnText:   { fontSize: 13, color: '#0369a1', fontWeight: '600' },
});
