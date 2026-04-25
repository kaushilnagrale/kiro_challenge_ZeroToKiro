import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RootStackParamList } from '../../App';
import { api } from '../api/client';
import { BiosignalPanel } from '../components/BiosignalPanel';
import { ProvenanceModal } from '../components/ProvenanceModal';
import { RouteMap } from '../components/RouteMap';
import { StopAlert } from '../components/StopAlert';
import { useStore } from '../store/useStore';

type Props = NativeStackScreenProps<RootStackParamList, 'Ride'>;

const POLL_MS = 3000;
const RISK_MS = 5000;

export function RideScreen({ navigation }: Props) {
  const {
    activeRoute,
    origin,
    destination,
    bioSessionId,
    bioReading,
    setBioReading,
    riskResponse,
    setRiskResponse,
    weather,
    pendingAlert,
    showAlert,
    dismissAlert,
    endRide,
    provenanceTarget,
    setProvenanceTarget,
  } = useStore();

  const [rideMinutes, setRideMinutes] = useState(0);
  const bioTimer  = useRef<ReturnType<typeof setInterval> | null>(null);
  const riskTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const clockRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    clockRef.current = setInterval(() => setRideMinutes((m) => m + 1 / 60), 1000);
    return () => { if (clockRef.current) clearInterval(clockRef.current); };
  }, []);

  const pollBio = useCallback(async () => {
    if (!bioSessionId) return;
    try { setBioReading(await api.readBio(bioSessionId)); } catch { /* non-fatal */ }
  }, [bioSessionId, setBioReading]);

  useEffect(() => {
    pollBio();
    bioTimer.current = setInterval(pollBio, POLL_MS);
    return () => { if (bioTimer.current) clearInterval(bioTimer.current); };
  }, [pollBio]);

  const assessRisk = useCallback(async () => {
    if (!bioReading) return;
    try {
      const risk = await api.fetchRisk({
        hr: bioReading.hr, hrv: bioReading.hrv,
        skin_temp_c: bioReading.skin_temp_c,
        ambient_temp_c: weather?.ambient_temp_c ?? 41.0,
        ride_minutes: rideMinutes, baseline_hr: 65,
      });
      setRiskResponse(risk);
      if (risk.score !== 'green' && !pendingAlert) {
        const stop = activeRoute?.water_stops?.[0] ?? null;
        showAlert({
          message: stop
            ? `Water fountain ahead in ${stop.distance_m?.toFixed(0) ?? '~200'}m. Recommended stop: 3 min.`
            : 'Consider finding water soon.',
          stop,
          reasons: risk.reasons,
        });
      }
    } catch { /* non-fatal */ }
  }, [bioReading, weather, rideMinutes, pendingAlert, activeRoute, setRiskResponse, showAlert]);

  useEffect(() => {
    riskTimer.current = setInterval(assessRisk, RISK_MS);
    return () => { if (riskTimer.current) clearInterval(riskTimer.current); };
  }, [assessRisk]);

  const handleEndRide = () => {
    if (bioTimer.current)  clearInterval(bioTimer.current);
    if (riskTimer.current) clearInterval(riskTimer.current);
    if (clockRef.current)  clearInterval(clockRef.current);
    endRide();
    navigation.replace('Summary');
  };

  if (!activeRoute || !origin || !destination) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>No active route. Go back and choose a route.</Text>
      </View>
    );
  }

  const mins = Math.floor(rideMinutes);
  const secs = Math.floor((rideMinutes - mins) * 60);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <RouteMap
        origin={origin}
        destination={destination}
        activeRoute={activeRoute}
        height={240}
      />

      <View style={styles.elapsedBar}>
        <Text style={styles.elapsedText}>⏱ {mins}:{secs.toString().padStart(2, '0')}</Text>
        <Text style={styles.elapsedText}>{activeRoute.type === 'pulseroute' ? '🌊 PulseRoute' : '⚡ Fastest'}</Text>
        <Text style={styles.elapsedText}>{(activeRoute.distance_m / 1000).toFixed(1)} km</Text>
      </View>

      {pendingAlert && (
        <StopAlert
          message={pendingAlert.message}
          stop={pendingAlert.stop}
          reasons={pendingAlert.reasons}
          score={riskResponse?.score ?? 'yellow'}
          onDismiss={dismissAlert}
          onProvenanceTap={() => setProvenanceTarget(riskResponse)}
        />
      )}

      <ScrollView style={styles.bottomScroll} bounces={false}>
        <BiosignalPanel
          reading={bioReading}
          score={riskResponse?.score ?? 'green'}
          onProvenanceTap={() => riskResponse && setProvenanceTarget(riskResponse)}
        />
        <TouchableOpacity style={styles.endButton} onPress={handleEndRide}>
          <Text style={styles.endButtonText}>End Ride</Text>
        </TouchableOpacity>
      </ScrollView>

      <ProvenanceModal
        visible={!!provenanceTarget}
        provenance={provenanceTarget && 'provenance' in provenanceTarget ? provenanceTarget.provenance : null}
        onClose={() => setProvenanceTarget(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: '#f0f9ff' },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText:    { color: '#64748b', fontSize: 16 },
  elapsedBar:   { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#0369a1', paddingHorizontal: 16, paddingVertical: 8 },
  elapsedText:  { color: '#fff', fontSize: 13, fontWeight: '700' },
  bottomScroll: { flex: 1 },
  endButton:    { backgroundColor: '#64748b', margin: 16, borderRadius: 12, padding: 14, alignItems: 'center' },
  endButtonText:{ color: '#fff', fontSize: 16, fontWeight: '700' },
});
