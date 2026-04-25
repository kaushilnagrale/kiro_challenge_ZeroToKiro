import React from 'react';
import { BioReading } from '../types';

interface Props {
  reading: BioReading | null;
  score: 'green' | 'yellow' | 'red';
}

const SCORE = {
  green:  { border: 'border-green-500/40',  text: 'text-green-400',  label: 'HYDRATED',  dot: 'bg-green-500'  },
  yellow: { border: 'border-yellow-500/40', text: 'text-yellow-400', label: 'WATCH',     dot: 'bg-yellow-400' },
  red:    { border: 'border-red-500/40',    text: 'text-red-400',    label: 'STOP SOON', dot: 'bg-red-500'    },
};

export function BiosignalPanel({ reading, score }: Props) {
  const cfg  = SCORE[score];
  const hr   = reading?.hr.toFixed(0) ?? '—';
  const hrv  = reading?.hrv.toFixed(0) ?? '—';
  const skin = reading ? `${((reading.skin_temp_c * 9/5) + 32).toFixed(1)}` : '—';
  const mode = reading?.mode ?? 'baseline';

  const hrAlert   = reading && reading.hr > 100;
  const hrvAlert  = reading && reading.hrv < 30;
  const skinAlert = reading && reading.skin_temp_c > 36;

  return (
    <div className={`bg-[#161b22] border-2 rounded-xl p-4 ${cfg.border}`}>
      {/* Score row */}
      <div className="flex items-center gap-2 mb-4">
        <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot} ${score !== 'green' ? 'animate-pulse' : ''}`} />
        <span className={`font-black text-xs tracking-widest uppercase ${cfg.text}`}>
          HYDRATION: {cfg.label}
        </span>
      </div>

      {/* 4 tickers */}
      <div className="grid grid-cols-4 gap-1">
        {[
          { label: 'HR',    value: hr,   unit: 'bpm', alert: hrAlert },
          { label: 'HRV',   value: hrv,  unit: 'ms',  alert: hrvAlert },
          { label: 'SKIN',  value: skin, unit: '°F',  alert: skinAlert },
          {
            label: 'STATE',
            value: mode === 'dehydrating' ? '🌡️' : mode === 'moderate' ? '🚴' : '😊',
            unit:  mode,
            alert: mode === 'dehydrating',
          },
        ].map(({ label, value, unit, alert }) => (
          <div key={label} className="bg-[#0d1117] rounded-xl p-2.5 text-center">
            <p className="text-[9px] font-bold text-[#4d5562] tracking-widest uppercase mb-1">{label}</p>
            <p className={`text-2xl font-black leading-none ${alert ? 'text-red-400' : 'text-white'}`}>{value}</p>
            <p className="text-[9px] text-[#7d8590] mt-1 truncate">{unit}</p>
          </div>
        ))}
      </div>

      <p className="text-center text-[10px] text-[#4d5562] mt-3">
        Biosignals: calibrated simulator · Phase 2 → Apple HealthKit
      </p>
    </div>
  );
}
