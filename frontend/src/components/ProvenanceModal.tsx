import React from 'react';
import { ProvenanceObj } from '../types';

interface Props {
  open: boolean;
  provenance: ProvenanceObj | null;
  onClose: () => void;
}

function Row({ icon, label, value, ts, ok }: {
  icon: string; label: string; value: string | null; ts?: string | null; ok: boolean;
}) {
  return (
    <div className={`rounded-xl border p-3 flex gap-3 items-start ${
      ok ? 'bg-[#0d1117] border-[#30363d]' : 'bg-red-500/10 border-red-500/30'
    }`}>
      <span className="text-xl">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-[#7d8590] uppercase tracking-widest mb-0.5">{label}</p>
        <p className={`text-sm font-semibold break-all ${ok ? 'text-[#e6edf3]' : 'text-red-400'}`}>
          {value ?? '⚠️ Missing — alert suppressed'}
        </p>
        {ts && <p className="text-[10px] text-[#4d5562] mt-0.5">as of {new Date(ts).toLocaleTimeString()}</p>}
      </div>
      <span>{ok ? '✅' : '❌'}</span>
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="bg-[#161b22] border border-[#30363d] w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#0d1117] border-b border-[#30363d] px-5 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-white font-black text-lg">Data Sources</h2>
            <p className="text-[#7d8590] text-xs mt-0.5">Provenance for this alert</p>
          </div>
          <button
            onClick={onClose}
            className="bg-[#21262d] hover:bg-[#30363d] text-[#7d8590] text-sm font-bold px-3 py-1.5 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>

        <div className={`px-5 py-2.5 text-sm font-bold text-center ${
          allOk ? 'bg-green-500/10 text-green-400 border-b border-green-500/20'
                : 'bg-red-500/10 text-red-400 border-b border-red-500/20'
        }`}>
          {allOk ? '✅ All sources verified' : '❌ Source missing — alert suppressed'}
        </div>

        <div className="p-5 space-y-3 max-h-[65vh] overflow-y-auto">
          <Row icon="💓" label="Biosignal Source"     value={provenance.biosignal_source_id}     ts={provenance.biosignal_timestamp}     ok={bioOk}   />
          <Row icon="🌡️" label="Environmental Source" value={provenance.environmental_source_id} ts={provenance.environmental_timestamp} ok={envOk}   />
          <Row icon="🗺️" label="Route Segment"        value={provenance.route_segment_id}                                                ok={routeOk} />

          <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-3 text-xs text-[#7d8590] space-y-1.5">
            <p>🌤️ Weather — Open-Meteo (open-meteo.com)</p>
            <p>🗺️ Stops — OpenStreetMap via Overpass API</p>
            <p>🚴 Routing — OSRM (router.project-osrm.org)</p>
            <p>📍 Geocoding — Nominatim (openstreetmap.org)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
