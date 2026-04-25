import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RootStackParamList } from '../../App';
import { ProvenanceModal } from '../components/ProvenanceModal';
import { RouteCard } from '../components/RouteCard';
import { RouteMap } from '../components/RouteMap';
import { useStore } from '../store/useStore';

type Props = NativeStackScreenProps<RootStackParamList, 'RouteCompare'>;

const { width } = Dimensions.get('window');

export function RouteCompareScreen({ navigation }: Props) {
  const {
    routeResponse,
    stops,
    weather,
    origin,
    destination,
    setActiveRoute,
    startRide,
    setBioSession,
    setBioMode,
    bioMode,
    provenanceTarget,
    setProvenanceTarget,
  } = useStore();

  const [selected, setSelected] = useState<'fastest' | 'pulseroute'>('pulseroute');
  const [showWhy, setShowWhy] = useState(false);

  if (!routeResponse || !origin || !destination) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>No route data. Go back and search.</Text>
      </View>
    );
  }

  const { fastest, pulseroute, provenance } = routeResponse;

  const allStops = [
    ...(stops?.fountains ?? []),
    ...(stops?.cafes ?? []),
    ...(stops?.repair ?? []),
  ];

  const handleStartRide = async () => {
    const route = selected === 'pulseroute' ? pulseroute : fastest;
    setActiveRoute(route);
    startRide();
    const { api } = await import('../api/client');
    try {
      const session = await api.startBioSession(bioMode);
      setBioSession(session.session_id, session.mode);
    } catch { /* non-fatal */ }
    navigation.navigate('Ride');
  };

  const mrtSaved = pulseroute.mrt_differential ?? (fastest.peak_mrt_c - pulseroute.peak_mrt_c);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Map */}
      <RouteMap
        origin={origin}
        destination={destination}
        fastest={fastest}
        pulseroute={pulseroute}
        stops={allStops}
        selectedType={selected}
        height={240}
      />

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: '#ef4444' }]} /><Text style={styles.legendText}>Fastest</Text></View>
        <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: '#0ea5e9' }]} /><Text style={styles.legendText}>PulseRoute</Text></View>
        <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: '#0ea5e9' }]} /><Text style={styles.legendText}>💧 Water</Text></View>
        <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: '#f97316' }]} /><Text style={styles.legendText}>☕ Cafe</Text></View>
      </View>

      {/* Route cards */}
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={styles.cardsScroll}
        contentContainerStyle={styles.cardsContent}
        onMomentumScrollEnd={(e) => {
          const page = Math.round(e.nativeEvent.contentOffset.x / (width - 32));
          setSelected(page === 0 ? 'pulseroute' : 'fastest');
        }}
      >
        <RouteCard route={pulseroute} isSelected={selected === 'pulseroute'} onSelect={() => setSelected('pulseroute')} onWhyTap={() => setShowWhy(true)} />
        <RouteCard route={fastest}    isSelected={selected === 'fastest'}    onSelect={() => setSelected('fastest')} />
      </ScrollView>

      {/* "Why this route?" */}
      {showWhy && (
        <View style={styles.whyCard}>
          <Text style={styles.whyTitle}>Why PulseRoute?</Text>
          <Text style={styles.whyItem}>🌿 {pulseroute.shade_pct}% shaded (vs {fastest.shade_pct}% fastest)</Text>
          <Text style={styles.whyItem}>🌡️ {mrtSaved.toFixed(1)}°C lower peak radiant temp</Text>
          <Text style={styles.whyItem}>💧 {pulseroute.water_stops.length} water stops on route</Text>
          <Text style={styles.whyItem}>📚 Buo, Khan, Middel et al. (2026)</Text>
          <TouchableOpacity onPress={() => setShowWhy(false)}><Text style={styles.whyClose}>Close</Text></TouchableOpacity>
        </View>
      )}

      {/* Weather strip */}
      {weather && (
        <View style={styles.weatherStrip}>
          <Text style={styles.weatherText}>🌡️ {weather.ambient_temp_c.toFixed(0)}°C · 💧 {weather.humidity_pct.toFixed(0)}% humidity · Feels {weather.heat_index_c.toFixed(0)}°C</Text>
        </View>
      )}

      {/* Debug: bio sim mode */}
      <View style={styles.modeRow}>
        <Text style={styles.modeLabel}>Sim mode:</Text>
        {(['baseline', 'moderate', 'dehydrating'] as const).map((m) => (
          <TouchableOpacity key={m} style={[styles.modeChip, bioMode === m && styles.modeChipActive]} onPress={() => setBioMode(m)}>
            <Text style={[styles.modeChipText, bioMode === m && styles.modeChipTextActive]}>{m}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.provenanceBtn} onPress={() => setProvenanceTarget(routeResponse)}>
        <Text style={styles.provenanceBtnText}>🔍 Data sources</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.startButton} onPress={handleStartRide}>
        <Text style={styles.startButtonText}>Start {selected === 'pulseroute' ? 'PulseRoute' : 'Fastest Route'} →</Text>
      </TouchableOpacity>

      <ProvenanceModal
        visible={!!provenanceTarget}
        provenance={provenanceTarget && 'provenance' in provenanceTarget ? provenanceTarget.provenance : null}
        onClose={() => setProvenanceTarget(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:              { flex: 1, backgroundColor: '#f0f9ff' },
  center:            { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText:         { color: '#64748b', fontSize: 16 },
  legend:            { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 6, gap: 12 },
  legendItem:        { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot:               { width: 10, height: 10, borderRadius: 5 },
  legendText:        { fontSize: 11, color: '#475569' },
  cardsScroll:       { flexGrow: 0 },
  cardsContent:      { paddingHorizontal: 16, paddingVertical: 8, gap: 12 },
  whyCard:           { backgroundColor: '#eff6ff', borderRadius: 12, margin: 12, padding: 14, borderWidth: 1, borderColor: '#bfdbfe' },
  whyTitle:          { fontWeight: '700', fontSize: 15, color: '#1e40af', marginBottom: 8 },
  whyItem:           { fontSize: 13, color: '#1e3a8a', marginBottom: 4 },
  whyClose:          { color: '#3b82f6', fontWeight: '600', marginTop: 8, textAlign: 'right' },
  weatherStrip:      { backgroundColor: '#fef9c3', paddingHorizontal: 16, paddingVertical: 6, borderTopWidth: 1, borderColor: '#fde047' },
  weatherText:       { fontSize: 12, color: '#713f12', textAlign: 'center', fontWeight: '500' },
  modeRow:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 6, gap: 6, backgroundColor: '#fff' },
  modeLabel:         { fontSize: 12, color: '#64748b', marginRight: 4 },
  modeChip:          { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  modeChipActive:    { backgroundColor: '#0369a1', borderColor: '#0369a1' },
  modeChipText:      { fontSize: 11, color: '#475569', fontWeight: '600' },
  modeChipTextActive: { color: '#fff' },
  provenanceBtn:     { alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 6, marginTop: 4 },
  provenanceBtnText: { color: '#0369a1', fontSize: 13, fontWeight: '600' },
  startButton:       { backgroundColor: '#0369a1', margin: 12, borderRadius: 14, padding: 16, alignItems: 'center' },
  startButtonText:   { color: '#fff', fontSize: 17, fontWeight: '700' },
});
