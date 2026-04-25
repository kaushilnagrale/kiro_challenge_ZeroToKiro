import React from 'react';
import { StopPoint } from '../types';

interface Props {
  message: string;
  stop: StopPoint | null;
  reasons: string[];
  score: 'green' | 'yellow' | 'red';
  onDismiss: () => void;
  onProvenance: () => void;
}

const SCORE_STYLE = {
  green:  { wrap: 'bg-green-50 border-green-400',   text: 'text-green-800',  icon: '💧' },
  yellow: { wrap: 'bg-yellow-50 border-yellow-400', text: 'text-yellow-800', icon: '⚠️' },
  red:    { wrap: 'bg-red-50 border-red-400',       text: 'text-red-800',    icon: '🚨' },
};

export function StopAlert({ message, stop, reasons, score, onDismiss, onProvenance }: Props) {
  const s = SCORE_STYLE[score];
  return (
    <div className={`rounded-xl border-2 p-4 shadow-lg ${s.wrap}`}>
      <div className="flex gap-3 items-start mb-2">
        <span className="text-2xl">{s.icon}</span>
        <p className={`font-semibold text-sm leading-snug flex-1 ${s.text}`}>{message}</p>
      </div>

      {reasons.slice(0, 2).map((r, i) => (
        <p key={i} className={`text-xs ml-10 mb-1 ${s.text}`}>· {r}</p>
      ))}

      {stop && (
        <div className="flex items-center gap-2 mt-2 bg-white/60 rounded-lg px-3 py-2">
          <span>{stop.type === 'fountain' ? '💧' : stop.type === 'cafe' ? '☕' : '🔧'}</span>
          <span className={`font-semibold text-sm flex-1 ${s.text}`}>{stop.name}</span>
          {stop.distance_m && <span className="text-xs text-slate-500">{stop.distance_m.toFixed(0)}m away</span>}
        </div>
      )}

      <div className="flex justify-between items-center mt-3">
        <button onClick={onProvenance} className={`text-xs font-bold underline ${s.text}`}>
          Why? (data sources) →
        </button>
        <button onClick={onDismiss} className="text-xs text-slate-400 font-semibold">
          Dismiss
        </button>
      </div>
    </div>
  );
}
