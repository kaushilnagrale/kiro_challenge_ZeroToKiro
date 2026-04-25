import React from 'react';
import { ProvenanceObj } from '../types';

interface Props {
  open: boolean;
  provenance: ProvenanceObj | null;
  onClose: () => void;
}

function Row({ icon, label, value, ts, ok }: { icon: string; label: string; value: string | null; ts?: string | null; ok: boolean }) {
  return (
    <div className={`rounded-lg border p-3 flex gap-3 items-start ${ok ? 'bg-white border-slate-200' : 'bg-red-50 border-red-300'}`}>
      <span className="text-xl">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-slate-500 mb-0.5">{label}</p>
        <p className={`text-sm font-semibold break-all ${ok ? 'text-slate-800' : 'text-red-700'}`}>
          {value ?? '⚠️ MISSING — alert suppressed by Logic Gate'}
        </p>
        {ts && <p className="text-xs text-slate-400 mt-0.5">as of {new Date(ts).toLocaleTimeString()}</p>}
      </div>
      <span className="text-lg">{ok ? '✅' : '❌'}</span>
    </div>
  );
}

export function ProvenanceModal({ open, provenance, onClose }: Props) {
  if (!open || !provenance) return null;
  const bioOk   = !!provenance.biosignal_source_id && !!provenance.biosignal_timestamp;
  const envOk   = !!provenance.environmental_source_id && !!provenance.environmental_timestamp;
  const routeOk = !!provenance.route_segment_id;
  const allOk   = bioOk && envOk && routeOk;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-sky-700 px-5 py-4 flex justify-between items-start">
          <div>
            <h2 className="text-white font-black text-lg">Data Provenance</h2>
            <p className="text-sky-200 text-xs">Accountability Logic Gate</p>
          </div>
          <button onClick={onClose} className="bg-white/20 text-white text-sm font-bold px-3 py-1.5 rounded-lg">Close</button>
        </div>

        {/* Gate status banner */}
        <div className={`px-5 py-3 text-sm font-bold text-center ${allOk ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {allOk ? '✅ All sources verified — alert cleared to display' : '❌ Missing source — alert suppressed, showing conservative defaults'}
        </div>

        <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Data Sources</p>
          <Row icon="💓" label="Biosignal Source" value={provenance.biosignal_source_id} ts={provenance.biosignal_timestamp} ok={bioOk} />
          <Row icon="🌡️" label="Environmental Source" value={provenance.environmental_source_id} ts={provenance.environmental_timestamp} ok={envOk} />
          <Row icon="🗺️" label="Route Segment ID" value={provenance.route_segment_id} ok={routeOk} />

          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider pt-2">Logic Gate — backend/safety.py</p>
          <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 text-xs text-sky-900 space-y-1 font-mono">
            <p>{'if biosignal_source_id is None:  return None'}</p>
            <p>{'if biosignal_age > 60s:          return None'}</p>
            <p>{'if env_source_id is None:        return None'}</p>
            <p>{'if env_age > 30min:              return None'}</p>
            <p>{'if route_segment_id is None:     return None'}</p>
            <p className="text-green-700 font-bold">{'return alert  # all checks passed'}</p>
          </div>

          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider pt-2">Scientific Attribution</p>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
            <p>📚 Route MRT: Buo, Khan, Middel et al. (2026) "Cool Routes", Building & Environment, ASU</p>
            <p>🌤️ Weather: Open-Meteo (open-meteo.com) — free, no API key</p>
            <p>🗺️ Map & stops: OpenStreetMap via Overpass API — ODbL license</p>
            <p>🚴 Routing: OSRM public API (router.project-osrm.org) — free, no API key</p>
          </div>
        </div>
      </div>
    </div>
  );
}
