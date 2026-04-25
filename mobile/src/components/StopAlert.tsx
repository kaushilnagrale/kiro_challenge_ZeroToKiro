import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StopPoint } from '../types';

interface Props {
  message: string;
  stop: StopPoint | null;
  reasons: string[];
  score: 'green' | 'yellow' | 'red';
  onDismiss: () => void;
  onProvenanceTap: () => void;
}

const SCORE_BORDER = {
  green:  '#86efac',
  yellow: '#fde047',
  red:    '#fca5a5',
};
const SCORE_BG = {
  green:  '#f0fdf4',
  yellow: '#fefce8',
  red:    '#fff1f2',
};
const SCORE_TEXT = {
  green:  '#166534',
  yellow: '#713f12',
  red:    '#991b1b',
};

export function StopAlert({ message, stop, reasons, score, onDismiss, onProvenanceTap }: Props) {
  const borderColor = SCORE_BORDER[score];
  const bgColor     = SCORE_BG[score];
  const textColor   = SCORE_TEXT[score];

  return (
    <View style={[styles.card, { backgroundColor: bgColor, borderColor }]}>
      {/* Icon + message */}
      <View style={styles.row}>
        <Text style={styles.icon}>
          {score === 'red' ? '🚨' : score === 'yellow' ? '⚠️' : '💧'}
        </Text>
        <Text style={[styles.message, { color: textColor }]}>{message}</Text>
      </View>

      {/* Reasons */}
      {reasons.slice(0, 2).map((r, i) => (
        <Text key={i} style={[styles.reason, { color: textColor }]}>
          · {r}
        </Text>
      ))}

      {/* Stop info */}
      {stop && (
        <View style={styles.stopRow}>
          <Text style={styles.stopEmoji}>
            {stop.type === 'fountain' ? '💧' : stop.type === 'cafe' ? '☕' : '🔧'}
          </Text>
          <Text style={[styles.stopName, { color: textColor }]}>{stop.name}</Text>
          {stop.distance_m && (
            <Text style={styles.stopDist}>{stop.distance_m.toFixed(0)}m away</Text>
          )}
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity onPress={onProvenanceTap} style={styles.actionBtn}>
          <Text style={[styles.actionText, { color: textColor }]}>Why? (data sources) →</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDismiss} style={styles.dismissBtn}>
          <Text style={styles.dismissText}>Dismiss</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 4,
  },
  row:        { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  icon:       { fontSize: 22, marginRight: 10, marginTop: 2 },
  message:    { flex: 1, fontSize: 14, fontWeight: '600', lineHeight: 20 },
  reason:     { fontSize: 12, marginLeft: 32, marginBottom: 2 },
  stopRow:    {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 8,
    padding: 8,
    gap: 6,
  },
  stopEmoji:  { fontSize: 16 },
  stopName:   { flex: 1, fontSize: 13, fontWeight: '600' },
  stopDist:   { fontSize: 12, color: '#64748b' },
  actions:    { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  actionBtn:  { padding: 4 },
  actionText: { fontSize: 12, fontWeight: '600' },
  dismissBtn: { padding: 4 },
  dismissText: { fontSize: 12, color: '#94a3b8', fontWeight: '600' },
});
