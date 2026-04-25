import { useStore } from '../store'

export function ProvenanceModal() {
  const { provenanceModal, setProvenanceModal } = useStore()
  if (!provenanceModal) return null

  const { provenance, message, timestamp } = provenanceModal

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={() => setProvenanceModal(null)}
    >
      <div
        className="w-full max-w-md bg-surface rounded-t-2xl p-5 pb-8 border-t border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-4" />
        <h3 className="text-orange font-semibold text-base mb-1">Data Provenance</h3>
        <p className="text-white/70 text-sm mb-4">{message}</p>

        <div className="space-y-3 text-sm">
          <ProvenanceRow label="Biosignal source" value={provenance.biosignal_source} ts={provenance.biosignal_ts} />
          <ProvenanceRow label="Environmental source" value={provenance.env_source} ts={provenance.env_ts} />
          <div className="flex justify-between items-start py-2 border-b border-border">
            <span className="text-white/50">Route segment</span>
            <span className="text-white font-mono text-xs">{provenance.route_segment_id}</span>
          </div>
          <div className="flex justify-between items-start py-2">
            <span className="text-white/50">Alert generated</span>
            <span className="text-white/80 text-xs">{new Date(timestamp).toLocaleTimeString()}</span>
          </div>
        </div>

        <p className="mt-4 text-xs text-white/30 text-center">
          Methodology: Buo, Khan, Middel et al. — Cool Routes (2026)
        </p>

        <button
          onClick={() => setProvenanceModal(null)}
          className="mt-4 w-full py-3 rounded-xl bg-border text-white/70 text-sm font-medium"
        >
          Close
        </button>
      </div>
    </div>
  )
}

function ProvenanceRow({ label, value, ts }: { label: string; value: string; ts: string }) {
  return (
    <div className="py-2 border-b border-border">
      <div className="flex justify-between items-start">
        <span className="text-white/50">{label}</span>
        <span className="text-white font-medium text-right max-w-[55%]">{value}</span>
      </div>
      <div className="text-right text-white/30 text-xs mt-0.5">{new Date(ts).toLocaleString()}</div>
    </div>
  )
}
