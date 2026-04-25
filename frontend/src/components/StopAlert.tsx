import React from 'react';
import { StopPoint } from '../types';

const M_TO_FT = 3.28084;
const M_TO_MI = 0.000621371;

function fmtDist(m: number): string {
  if (m < 500) return `${Math.round(m * M_TO_FT)} ft`;
  return `${(m * M_TO_MI).toFixed(2)} mi`;
}

interface Props {
  message: string;
  stop: StopPoint | null;
  reasons: string[];
  score: 'green' | 'yellow' | 'red';
  onDismiss: () => void;
}

const STYLE = {
  green:  { wrap: 'bg-green-500/10 border-green-500/40',   text: 'text-green-400',  icon: '💧' },
  yellow: { wrap: 'bg-yellow-500/10 border-yellow-500/40', text: 'text-yellow-400', icon: '⚠️' },
  red:    { wrap: 'bg-red-500/10 border-red-500/40',       text: 'text-red-400',    icon: '🚨' },
};

export function StopAlert({ message, stop, reasons, score, onDismiss }: Props) {
  const s = STYLE[score];
  return (
    <div className={`rounded-xl border-2 p-4 ${s.wrap}`}>
      <div className="flex gap-3 items-start mb-2">
        <span className="text-2xl">{s.icon}</span>
        <p className={`font-bold text-sm leading-snug flex-1 ${s.text}`}>{message}</p>
      </div>

      {reasons.slice(0, 2).map((r, i) => (
        <p key={i} className={`text-xs ml-11 mb-1 ${s.text} opacity-80`}>· {r}</p>
      ))}

      {stop && (
        <div className="flex items-center gap-2 mt-3 bg-[#0d1117]/60 rounded-lg px-3 py-2.5 border border-[#30363d]">
          <span className="text-lg">{stop.type === 'fountain' ? '💧' : stop.type === 'cafe' ? '☕' : '🔧'}</span>
          <span className={`font-semibold text-sm flex-1 ${s.text}`}>{stop.name}</span>
          {stop.distance_m && <span className="text-xs text-[#7d8590]">{fmtDist(stop.distance_m)}</span>}
        </div>
      )}

      <div className="flex justify-end mt-3">
        <button
          onClick={onDismiss}
          className="text-xs text-[#7d8590] hover:text-[#e6edf3] font-semibold transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
