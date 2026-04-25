import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RootStackParamList } from '../../App';
import { useStore } from '../store/useStore';

type Props = NativeStackScreenProps<RootStackParamList, 'Summary'>;

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${s}s`;
}

function ScoreBadge({ score }: { score: 'green' | 'yellow' | 'red' }) {
  const colors = {
    green:  { bg: '#dcfce7', text: '#166534', label: '🟢 Green — No issues' },
    yellow: { bg: '#fef9c3', text: '#713f12', label: '🟡 Yellow — Mild heat stress' },
    red:    { bg: '#fee2e2', text: '#991b1b', label: '🔴 Red — Heat stress detected' },
  };
  const c = colors[score];
  return (
    <View style={[styles.scoreBadge, { backgroundColor: c.bg }]}>
      <Text style={[styles.scoreBadgeText, { color: c.text }]}>{c.label}</Text>
    </View>
  );
}

function StatCard({ icon, label, value, sub }: { icon: string; label: string; value: string; sub?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statIcon}>{icon}</Text>
      <View style={styles.statInfo}>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statValue}>{value}</Text>
        {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

export function SummaryScreen({ navigation }: Props) {
  const {
    rideStats,
    activeRoute,
    routeResponse,
    riskResponse,
    reset,
  } = useStore();

  const fastest   = routeResponse?.fastest;
  const pulseroute = routeResponse?.pulseroute;

  const rideDuration = rideStats?.startTime && rideStats?.endTime
    ? rideStats.endTime.getTime() - rideStats.startTime.getTime()
    : null;

  const mrt_saved = fastest && pulseroute
    ? (fastest.peak_mrt_c - pulseroute.peak_mrt_c).toFixed(1)
    : '—';

  const exposure = activeRoute
    ? ((activeRoute.peak_mrt_c * (activeRoute.duration_s / 60)) / 100).toFixed(1)
    : '—';

  const handleNewRide = () => {
    reset();
    navigation.replace('Search');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Ride Complete 🎉</Text>
          <Text style={styles.headerSub}>
            You chose the {activeRoute?.type === 'pulseroute' ? 'cool, safe PulseRoute' : 'fastest route'}.
          </Text>
        </View>

        {/* Peak risk */}
        {rideStats?.peakRiskScore && (
          <>
            <Text style={styles.sectionTitle}>Peak Risk Level</Text>
            <ScoreBadge score={riskResponse?.score ?? 'green'} />
          </>
        )}

        {/* Stats grid */}
        <Text style={styles.sectionTitle}>Ride Stats</Text>
        <View style={styles.statsGrid}>
          <StatCard
            icon="📏"
            label="Distance"
            value={activeRoute ? `${(activeRoute.distance_m / 1000).toFixed(2)} km` : '—'}
          />
          <StatCard
            icon="⏱"
            label="Duration"
            value={rideDuration ? formatDuration(rideDuration) : '—'}
          />
          <StatCard
            icon="🌡️"
            label="Peak MRT"
            value={activeRoute ? `${activeRoute.peak_mrt_c}°C` : '—'}
            sub="Mean Radiant Temp"
          />
          <StatCard
            icon="🌿"
            label="Shade"
            value={activeRoute ? `${activeRoute.shade_pct}%` : '—'}
          />
          <StatCard
            icon="💧"
            label="Water Stops"
            value={String(activeRoute?.water_stops.length ?? 0)}
            sub="on your route"
          />
          <StatCard
            icon="☀️"
            label="Exposure"
            value={exposure === '—' ? '—' : `${exposure} °C·min`}
            sub="cumulative heat"
          />
        </View>

        {/* vs Fastest comparison */}
        {fastest && pulseroute && activeRoute?.type === 'pulseroute' && (
          <View style={styles.comparisonCard}>
            <Text style={styles.comparisonTitle}>vs. Fastest Route</Text>
            <View style={styles.comparisonRow}>
              <Text style={styles.comparisonLabel}>MRT saved</Text>
              <Text style={styles.comparisonValue}>−{mrt_saved}°C</Text>
            </View>
            <View style={styles.comparisonRow}>
              <Text style={styles.comparisonLabel}>Extra shade</Text>
              <Text style={styles.comparisonValue}>
                +{(pulseroute.shade_pct - fastest.shade_pct).toFixed(0)}%
              </Text>
            </View>
            <View style={styles.comparisonRow}>
              <Text style={styles.comparisonLabel}>Water stops</Text>
              <Text style={styles.comparisonValue}>{pulseroute.water_stops.length} vs 0</Text>
            </View>
            <View style={styles.comparisonRow}>
              <Text style={styles.comparisonLabel}>Extra time</Text>
              <Text style={styles.comparisonValue}>
                +{Math.round((pulseroute.duration_s - fastest.duration_s) / 60)} min
              </Text>
            </View>
          </View>
        )}

        {/* Science citation */}
        <View style={styles.citationCard}>
          <Text style={styles.citationTitle}>Data Attribution</Text>
          <Text style={styles.citationText}>
            Route MRT analysis based on Buo, Khan, Middel et al. (2026) "Cool Routes",{' '}
            Building & Environment, ASU. Weather: Open-Meteo. Stops: OSM Overpass.
          </Text>
        </View>

        {/* New ride */}
        <TouchableOpacity style={styles.newRideButton} onPress={handleNewRide}>
          <Text style={styles.newRideText}>New Ride</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: '#f0f9ff' },
  container:        { padding: 16, paddingBottom: 40 },
  header:           {
    backgroundColor: '#0369a1',
    borderRadius: 14,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
  },
  headerTitle:      { fontSize: 22, fontWeight: '800', color: '#fff' },
  headerSub:        { fontSize: 14, color: '#bae6fd', marginTop: 4, textAlign: 'center' },
  sectionTitle:     { fontSize: 14, fontWeight: '700', color: '#64748b', marginVertical: 10, letterSpacing: 0.5 },
  scoreBadge:       { borderRadius: 10, padding: 12, marginBottom: 12, alignItems: 'center' },
  scoreBadgeText:   { fontSize: 15, fontWeight: '700' },
  statsGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  statCard:         {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  statIcon:         { fontSize: 24 },
  statInfo:         { flex: 1 },
  statLabel:        { fontSize: 11, color: '#64748b', fontWeight: '600' },
  statValue:        { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  statSub:          { fontSize: 10, color: '#94a3b8' },
  comparisonCard:   {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  comparisonTitle:  { fontWeight: '700', fontSize: 15, color: '#1e40af', marginBottom: 10 },
  comparisonRow:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  comparisonLabel:  { fontSize: 13, color: '#1e3a8a' },
  comparisonValue:  { fontSize: 13, fontWeight: '700', color: '#1e40af' },
  citationCard:     {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  citationTitle:    { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 4 },
  citationText:     { fontSize: 11, color: '#64748b', lineHeight: 16 },
  newRideButton:    {
    backgroundColor: '#0369a1',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  newRideText:      { color: '#fff', fontSize: 17, fontWeight: '700' },
});
