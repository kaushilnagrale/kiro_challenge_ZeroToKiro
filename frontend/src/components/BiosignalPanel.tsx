import React from 'react';
import { BioReading } from '../types';

interface Props {
  reading: BioReading | null;
  score: 'green' | 'yellow' | 'red';
  onProvenanceTap: () => void;
}

const SCORE = {
  green:  { bg: 'bg-green-50',  border: 'border-green-300',  text: 'text-green-800',  label: 'HYDRATED',   dot: '🟢' },
  yellow: { bg: 'bg-yellow-50', border: 'border-yellow-300', text: 'text-yellow-800', label: 'WATCH',      dot: '🟡' },
  red:    { bg: 'bg-red-50',    border: 'border-red-300',    text: 'text-red-800',    label: 'STOP SOON',  dot: '🔴' },
};

export function BiosignalPanel({ reading, score, onProvenanceTap }: Props) {
  const cfg = SCORE[score];
  const hr   = reading?.hr.toFixed(0)          ?? '—';
  const hrv  = reading?.hrv.toFixed(0)         ?? '—';
  const skin = reading?.skin_temp_c.toFixed(1) ?? '—';
  const mode = reading?.mode                   ?? 'baseline';

  return (
    <div className={`rounded-xl border-2 p-4 ${cfg.bg} ${cfg.border}`}>
      {/* Score row */}
      <div className="flex items-center justify-between mb-3">
        <span className={`font-black text-sm tracking-widest ${cfg.text}`}>
          {cfg.dot} HYDRATION RISK: {cfg.label}
        </span>
        <button onClick={onProvenanceTap} className={`text-xs font-bold underline ${cfg.text}`}>
          cite ›
        </button>
      </div>

      {/* 4 tickers */}
      <div className="grid grid-cols-4 divide-x divide-slate-200">
        {[
          { label: 'HR', value: hr, unit: 'bpm', alert: reading && reading.hr > 100 },
          { label: 'HRV', value: hrv, unit: 'ms', alert: reading && reading.hrv < 30 },
          { label: 'SKIN', value: skin, unit: '°C', alert: reading && reading.skin_temp_c > 36 },
          { label: 'MODE', value: mode === 'dehydrating' ? '🌡️' : mode === 'moderate' ? '🚴' : '😊', unit: mode },
        ].map(({ label, value, unit, alert }) => (
          <div key={label} className="flex flex-col items-center px-2">
            <span className="text-[10px] font-bold text-slate-500 tracking-widest">{label}</span>
            <span className={`text-2xl font-black ${alert ? 'text-red-600' : 'text-slate-900'}`}>{value}</span>
            <span className="text-[10px] text-slate-400">{unit}</span>
          </div>
        ))}
      </div>

      <p className="text-center text-[10px] text-slate-400 mt-2 italic">
        Biosignals: calibrated simulator · Phase 2 → Apple HealthKit (EAS build)
      </p>
    </div>
  );
}
