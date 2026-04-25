import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BioReading } from '../types';

interface Props {
  reading: BioReading | null;
  score: 'green' | 'yellow' | 'red';
  onProvenanceTap: () => void;
}

const SCORE_CONFIG = {
  green:  { bg: '#dcfce7', border: '#86efac', text: '#166534', label: 'HYDRATED',  emoji: '🟢' },
  yellow: { bg: '#fef9c3', border: '#fde047', text: '#713f12', label: 'WATCH',     emoji: '🟡' },
  red:    { bg: '#fee2e2', border: '#fca5a5', text: '#991b1b', label: 'STOP SOON', emoji: '🔴' },
};

function Ticker({ label, value, unit, alert }: { label: string; value: string; unit: string; alert?: boolean }) {
  return (
    <View style={styles.ticker}>
      <Text style={styles.tickerLabel}>{label}</Text>
      <Text style={[styles.tickerValue, alert && styles.tickerValueAlert]}>{value}</Text>
      <Text style={styles.tickerUnit}>{unit}</Text>
    </View>
  );
}

export function BiosignalPanel({ reading, score, onProvenanceTap }: Props) {
  const cfg = SCORE_CONFIG[score];

  const hr       = reading ? reading.hr.toFixed(0)        : '—';
  const hrv      = reading ? reading.hrv.toFixed(0)       : '—';
  const skinTemp = reading ? reading.skin_temp_c.toFixed(1) : '—';
  const mode     = reading ? reading.mode                 : 'baseline';

  const hrAlert   = reading ? reading.hr > 100  : false;
  const hrvAlert  = reading ? reading.hrv < 30  : false;
  const skinAlert = reading ? reading.skin_temp_c > 36 : false;

  return (
    <View style={[styles.panel, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
      {/* Score indicator */}
      <View style={styles.scoreRow}>
        <Text style={styles.scoreEmoji}>{cfg.emoji}</Text>
        <Text style={[styles.scoreLabel, { color: cfg.text }]}>
          HYDRATION RISK: {cfg.label}
        </Text>
        <TouchableOpacity onPress={onProvenanceTap} style={styles.provenanceBtn}>
          <Text style={[styles.provenanceBtnText, { color: cfg.text }]}>cite ›</Text>
        </TouchableOpacity>
      </View>

      {/* The 4 tickers — glanceable */}
      <View style={styles.tickers}>
        <Ticker
          label="HR"
          value={hr}
          unit="bpm"
          alert={hrAlert}
        />
        <View style={styles.divider} />
        <Ticker
          label="HRV"
          value={hrv}
          unit="ms"
          alert={hrvAlert}
        />
        <View style={styles.divider} />
        <Ticker
          label="Skin"
          value={skinTemp}
          unit="°C"
          alert={skinAlert}
        />
        <View style={styles.divider} />
        <Ticker
          label="Mode"
          value={mode === 'dehydrating' ? '🌡️' : mode === 'moderate' ? '🚴' : '😊'}
          unit={mode}
        />
      </View>

      {/* Simulation mode reminder */}
      <Text style={[styles.simNote, { color: cfg.text }]}>
        Biosignals: calibrated simulator · Phase 2 → HealthKit via EAS build
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    margin: 12,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  scoreEmoji:      { fontSize: 20, marginRight: 8 },
  scoreLabel:      { fontSize: 14, fontWeight: '800', flex: 1, letterSpacing: 0.5 },
  provenanceBtn:   { padding: 4 },
  provenanceBtnText: { fontSize: 12, fontWeight: '700' },
  tickers:         {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 10,
  },
  ticker:          { alignItems: 'center', flex: 1 },
  tickerLabel:     { fontSize: 10, fontWeight: '700', color: '#64748b', letterSpacing: 1, marginBottom: 2 },
  tickerValue:     { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  tickerValueAlert: { color: '#dc2626' },
  tickerUnit:      { fontSize: 10, color: '#94a3b8', marginTop: 1 },
  divider:         { width: 1, height: 40, backgroundColor: '#e2e8f0' },
  simNote:         { fontSize: 10, textAlign: 'center', opacity: 0.7 },
});
