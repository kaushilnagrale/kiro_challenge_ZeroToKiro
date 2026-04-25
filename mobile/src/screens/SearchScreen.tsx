import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RootStackParamList } from '../../App';
import { api } from '../api/client';
import { useStore } from '../store/useStore';

type Props = NativeStackScreenProps<RootStackParamList, 'Search'>;

const QUICK_DESTINATIONS = [
  { label: 'Tempe Town Lake', lat: 33.4255, lon: -111.9155 },
  { label: 'Mill Avenue District', lat: 33.4230, lon: -111.9172 },
  { label: 'Tempe Marketplace', lat: 33.4148, lon: -111.8960 },
  { label: 'Downtown Phoenix', lat: 33.4484, lon: -112.0740 },
];

export function SearchScreen({ navigation }: Props) {
  const [destText, setDestText] = useState('');
  const [loading, setLoading]   = useState(false);

  const {
    originLabel,
    setDestination,
    setRouteResponse,
    setStops,
    setWeather,
  } = useStore();

  const handleQuickDestination = async (dest: typeof QUICK_DESTINATIONS[0]) => {
    setLoading(true);
    try {
      setDestination({ latitude: dest.lat, longitude: dest.lon }, dest.label);
      setDestText(dest.label);

      const [routes, stops, weather] = await Promise.all([
        api.fetchRoutes([33.4176, -111.9341], [dest.lat, dest.lon]),
        api.fetchStops(),
        api.fetchWeather(dest.lat, dest.lon),
      ]);

      setRouteResponse(routes);
      setStops(stops);
      setWeather(weather);
      navigation.navigate('RouteCompare');
    } catch (e) {
      Alert.alert('Connection Error', 'Could not reach the PulseRoute backend. Make sure it is running on localhost:8000.');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomDestination = async () => {
    if (!destText.trim()) {
      Alert.alert('Enter a destination', 'Type where you want to ride to.');
      return;
    }
    // For the demo, treat typed text as Tempe Town Lake
    await handleQuickDestination({ label: destText, lat: 33.4255, lon: -111.9155 });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Heat advisory banner (placeholder — populated by weather fetch) */}
        <View style={styles.advisoryBanner}>
          <Text style={styles.advisoryText}>
            ☀️  Excessive Heat Warning · Tempe, AZ · Feels like 44°C
          </Text>
        </View>

        {/* Origin */}
        <View style={styles.card}>
          <Text style={styles.label}>FROM</Text>
          <View style={styles.inputRow}>
            <Text style={styles.locationIcon}>📍</Text>
            <Text style={styles.originText}>{originLabel}</Text>
          </View>
        </View>

        {/* Destination */}
        <View style={styles.card}>
          <Text style={styles.label}>TO</Text>
          <View style={styles.inputRow}>
            <Text style={styles.locationIcon}>🏁</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Where are you riding to?"
              placeholderTextColor="#94a3b8"
              value={destText}
              onChangeText={setDestText}
              onSubmitEditing={handleCustomDestination}
              returnKeyType="search"
            />
          </View>
        </View>

        {/* Quick destinations */}
        <Text style={styles.sectionTitle}>Quick destinations</Text>
        {QUICK_DESTINATIONS.map((dest) => (
          <TouchableOpacity
            key={dest.label}
            style={styles.quickCard}
            onPress={() => handleQuickDestination(dest)}
            disabled={loading}
          >
            <Text style={styles.quickIcon}>🚴</Text>
            <View style={styles.quickInfo}>
              <Text style={styles.quickLabel}>{dest.label}</Text>
              <Text style={styles.quickSub}>Tap to compare routes</Text>
            </View>
            <Text style={styles.quickArrow}>›</Text>
          </TouchableOpacity>
        ))}

        {/* Go button */}
        <TouchableOpacity
          style={[styles.goButton, loading && styles.goButtonDisabled]}
          onPress={handleCustomDestination}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.goButtonText}>Plan Cool Route →</Text>
          )}
        </TouchableOpacity>

        {/* Footer */}
        <Text style={styles.footer}>
          Route MRT data: Buo, Khan, Middel et al. (2026) · Open-Meteo · OSM Overpass
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: '#f0f9ff' },
  container:       { padding: 16, paddingBottom: 40 },
  advisoryBanner:  {
    backgroundColor: '#7c3aed',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  advisoryText:    { color: '#fff', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  card:            {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  label:           { fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 1, marginBottom: 6 },
  inputRow:        { flexDirection: 'row', alignItems: 'center' },
  locationIcon:    { fontSize: 18, marginRight: 10 },
  originText:      { fontSize: 16, fontWeight: '600', color: '#0f172a', flex: 1 },
  textInput:       { fontSize: 16, color: '#0f172a', flex: 1 },
  sectionTitle:    { fontSize: 14, fontWeight: '700', color: '#64748b', marginVertical: 12, letterSpacing: 0.5 },
  quickCard:       {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  quickIcon:       { fontSize: 22, marginRight: 12 },
  quickInfo:       { flex: 1 },
  quickLabel:      { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  quickSub:        { fontSize: 12, color: '#64748b', marginTop: 2 },
  quickArrow:      { fontSize: 22, color: '#94a3b8' },
  goButton:        {
    backgroundColor: '#0369a1',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  goButtonDisabled: { backgroundColor: '#7eb8d4' },
  goButtonText:    { color: '#fff', fontSize: 17, fontWeight: '700' },
  footer:          { textAlign: 'center', color: '#94a3b8', fontSize: 11, marginTop: 24 },
});
