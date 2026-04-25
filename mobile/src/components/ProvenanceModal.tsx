import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ProvenanceObj } from '../types';

interface Props {
  visible: boolean;
  provenance: ProvenanceObj | null;
  onClose: () => void;
}

function SourceRow({
  icon,
  label,
  value,
  timestamp,
  ok,
}: {
  icon: string;
  label: string;
  value: string | null;
  timestamp?: string | null;
  ok: boolean;
}) {
  return (
    <View style={[styles.sourceRow, !ok && styles.sourceRowMissing]}>
      <Text style={styles.sourceIcon}>{icon}</Text>
      <View style={styles.sourceInfo}>
        <Text style={styles.sourceLabel}>{label}</Text>
        <Text style={[styles.sourceValue, !ok && styles.sourceValueMissing]}>
          {value ?? '⚠️ MISSING — alert suppressed by Logic Gate'}
        </Text>
        {timestamp && (
          <Text style={styles.sourceTimestamp}>
            as of {new Date(timestamp).toLocaleTimeString()}
          </Text>
        )}
      </View>
      <Text style={styles.sourceStatus}>{ok ? '✅' : '❌'}</Text>
    </View>
  );
}

export function ProvenanceModal({ visible, provenance, onClose }: Props) {
  if (!provenance) return null;

  const bioOk  = !!provenance.biosignal_source_id && !!provenance.biosignal_timestamp;
  const envOk  = !!provenance.environmental_source_id && !!provenance.environmental_timestamp;
  const routeOk = !!provenance.route_segment_id;
  const allOk  = bioOk && envOk && routeOk;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Data Provenance</Text>
            <Text style={styles.subtitle}>Accountability Logic Gate</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </View>

        {/* Gate status */}
        <View style={[styles.gateBanner, allOk ? styles.gateBannerOk : styles.gateBannerFail]}>
          <Text style={styles.gateBannerText}>
            {allOk
              ? '✅ All data sources verified — alert cleared to display'
              : '❌ Missing data source — alert suppressed, showing conservative defaults'}
          </Text>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {/* Data sources */}
          <Text style={styles.sectionTitle}>Data Sources</Text>

          <SourceRow
            icon="💓"
            label="Biosignal Source"
            value={provenance.biosignal_source_id}
            timestamp={provenance.biosignal_timestamp}
            ok={bioOk}
          />
          <SourceRow
            icon="🌡️"
            label="Environmental Source"
            value={provenance.environmental_source_id}
            timestamp={provenance.environmental_timestamp}
            ok={envOk}
          />
          <SourceRow
            icon="🗺️"
            label="Route Segment ID"
            value={provenance.route_segment_id}
            ok={routeOk}
          />

          {/* Logic Gate explanation */}
          <Text style={styles.sectionTitle}>About the Accountability Logic Gate</Text>
          <View style={styles.explainCard}>
            <Text style={styles.explainText}>
              Before any safety alert appears on your screen, the{' '}
              <Text style={styles.code}>validate_safety_alert()</Text> function in{' '}
              <Text style={styles.code}>backend/safety.py</Text> checks:
            </Text>
            <Text style={styles.explainBullet}>
              • Biosignal data ≤ 60 seconds old
            </Text>
            <Text style={styles.explainBullet}>
              • Environmental data ≤ 30 minutes old
            </Text>
            <Text style={styles.explainBullet}>
              • Route segment ID present
            </Text>
            <Text style={styles.explainText}>
              If any field is null or stale, the function returns{' '}
              <Text style={styles.code}>None</Text> and PulseRoute shows
              "Sensor data unavailable — using conservative defaults."
              We never fabricate a safety recommendation.
            </Text>
          </View>

          {/* Attribution */}
          <Text style={styles.sectionTitle}>Scientific Attribution</Text>
          <View style={styles.citationCard}>
            <Text style={styles.citationText}>
              Route MRT methodology: Buo, Khan, Middel et al. (2026) "Cool Routes",{' '}
              Building & Environment, Arizona State University.
            </Text>
            <Text style={styles.citationText}>
              Weather data: Open-Meteo (open-meteo.com). Free, no API key required.
            </Text>
            <Text style={styles.citationText}>
              Map stops: OpenStreetMap via Overpass API (overpass-api.de). ODbL license.
            </Text>
            <Text style={styles.citationText}>
              Biosignals: calibrated simulator (Phase 2 → Apple HealthKit via EAS dev build).
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#f0f9ff' },
  header:          {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    backgroundColor: '#0369a1',
  },
  title:           { fontSize: 20, fontWeight: '800', color: '#fff' },
  subtitle:        { fontSize: 12, color: '#bae6fd', marginTop: 2 },
  closeBtn:        {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  closeBtnText:    { color: '#fff', fontWeight: '700' },
  gateBanner:      { padding: 12, alignItems: 'center' },
  gateBannerOk:    { backgroundColor: '#dcfce7' },
  gateBannerFail:  { backgroundColor: '#fee2e2' },
  gateBannerText:  { fontSize: 13, fontWeight: '700', textAlign: 'center', color: '#0f172a' },
  content:         { padding: 16, paddingBottom: 40 },
  sectionTitle:    {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
  },
  sourceRow:       {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sourceRowMissing: { borderColor: '#fca5a5', backgroundColor: '#fff1f2' },
  sourceIcon:       { fontSize: 20, marginRight: 10, marginTop: 2 },
  sourceInfo:       { flex: 1 },
  sourceLabel:      { fontSize: 12, fontWeight: '700', color: '#64748b', marginBottom: 2 },
  sourceValue:      { fontSize: 13, fontWeight: '600', color: '#0f172a' },
  sourceValueMissing: { color: '#dc2626' },
  sourceTimestamp:  { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  sourceStatus:     { fontSize: 18, marginLeft: 8 },
  explainCard:      {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  explainText:      { fontSize: 13, color: '#1e3a8a', lineHeight: 19, marginBottom: 8 },
  explainBullet:    { fontSize: 13, color: '#1e40af', marginLeft: 8, marginBottom: 4 },
  code:             { fontFamily: 'monospace', backgroundColor: '#dbeafe', color: '#1e40af' },
  citationCard:     {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  citationText:     { fontSize: 12, color: '#475569', lineHeight: 17 },
});
