import { useStore } from '../store'
import { RiskBadge } from '../components/RiskBadge'
import type { RideRecord } from '../types'

// Safety score: 100 - (red rides × 20) - (yellow rides × 5), min 0
function calcSafetyScore(history: RideRecord[]): number {
  if (!history.length) return 100
  const penalty = history.reduce((acc, r) => {
    if (r.peak_risk === 'red') return acc + 20
    if (r.peak_risk === 'yellow') return acc + 5
    return acc
  }, 0)
  return Math.max(0, 100 - penalty)
}

function ScoreRing({ score }: { score: number }) {
  const r = 28
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  const color = score >= 80 ? '#4ade80' : score >= 50 ? '#facc15' : '#f87171'
  return (
    <svg width="72" height="72" viewBox="0 0 72 72">
      <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
      <circle
        cx="36" cy="36" r={r} fill="none"
        stroke={color} strokeWidth="6"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 36 36)"
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
      <text x="36" y="40" textAnchor="middle" fill={color} fontSize="14" fontWeight="700">{score}</text>
    </svg>
  )
}

export function RideHistory() {
  const { rideHistory, setScreen } = useStore()

  const totalRides = rideHistory.length
  const totalKm = rideHistory.reduce((s, r) => s + r.distance_km, 0)
  const totalStops = rideHistory.reduce((s, r) => s + r.water_stops_taken, 0)
  const avgExposure = totalRides
    ? Math.round(rideHistory.reduce((s, r) => s + r.exposure_deg_min, 0) / totalRides)
    : 0
  const safetyScore = calcSafetyScore(rideHistory)
  const pulseRouteCount = rideHistory.filter((r) => r.route_type === 'pulseroute').length

  return (
    <div className="flex flex-col h-full pb-20 overflow-y-auto scrollbar-hide">
      <div className="px-5 pt-5 pb-4">
        <h2 className="text-2xl font-bold text-white">History</h2>
        <p className="text-white/40 text-sm mt-0.5">Your thermal exposure log</p>
      </div>

      {/* Safety score + stats */}
      <div className="mx-5 mb-5">
        <div className="bg-surface rounded-2xl p-4 border border-border/50 flex items-center gap-4 mb-3">
          <ScoreRing score={safetyScore} />
          <div>
            <p className="text-white font-semibold text-sm">Safety Score</p>
            <p className="text-white/40 text-xs mt-0.5">
              {safetyScore >= 80 ? 'Great riding habits' : safetyScore >= 50 ? 'Watch your heat exposure' : 'High heat risk pattern'}
            </p>
            <p className="text-white/30 text-xs mt-1">
              {pulseRouteCount}/{totalRides} rides used PulseRoute
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffb693" strokeWidth="2" strokeLinecap="round"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5L9 10l3-1 2 4h4"/></svg>}
            label="Total rides"
            value={`${totalRides}`}
          />
          <StatCard
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffb693" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>}
            label="Total km"
            value={`${totalKm.toFixed(1)}`}
          />
          <StatCard
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round"><path d="M12 22V12M12 12C12 12 7 9 7 5a5 5 0 0 1 10 0c0 4-5 7-5 7z"/></svg>}
            label="Water stops"
            value={`${totalStops}`}
          />
          <StatCard
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>}
            label="Avg exposure"
            value={`${avgExposure}`}
            unit="°C·min"
          />
        </div>
      </div>

      {/* Ride list */}
      {rideHistory.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center px-8">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/>
            <path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5L9 10l3-1 2 4h4"/>
          </svg>
          <p className="text-white/40 text-sm">No rides yet. Plan your first route!</p>
          <button onClick={() => setScreen('planner')} className="text-orange text-sm font-medium">
            Plan a ride →
          </button>
        </div>
      ) : (
        <div className="px-5 space-y-3 pb-4">
          {rideHistory.map((r) => (
            <RideCard key={r.id} ride={r} />
          ))}
        </div>
      )}
    </div>
  )
}

function RideCard({ ride }: { ride: RideRecord }) {
  const date = new Date(ride.date)
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="bg-surface rounded-2xl p-4 border border-border/50">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0 mr-3">
          <p className="text-white font-medium text-sm truncate">{ride.origin}</p>
          <div className="flex items-center gap-1 mt-0.5">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round">
              <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
            </svg>
            <p className="text-white/40 text-xs truncate">{ride.destination}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-white/50 text-xs">{dateStr}</p>
          <p className="text-white/30 text-xs">{timeStr}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs text-white/50 mb-3">
        <span>{ride.distance_km} km</span>
        <span>·</span>
        <span>{ride.duration_min} min</span>
        <span>·</span>
        <span className={ride.route_type === 'pulseroute' ? 'text-orange' : 'text-blue'}>
          {ride.route_type === 'pulseroute' ? 'PulseRoute' : 'Fastest'}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-3 text-xs">
          <span className="text-white/40">{ride.exposure_deg_min} °C·min</span>
          <span className="text-blue">{ride.water_stops_taken} stops</span>
        </div>
        <RiskBadge level={ride.peak_risk} />
      </div>
    </div>
  )
}

function StatCard({
  icon, label, value, unit,
}: {
  icon: React.ReactNode; label: string; value: string; unit?: string
}) {
  return (
    <div className="bg-surface rounded-2xl p-4 border border-border/50">
      <div className="mb-2">{icon}</div>
      <p className="text-white font-bold text-xl">
        {value}
        {unit && <span className="text-white/40 text-xs font-normal ml-1">{unit}</span>}
      </p>
      <p className="text-white/40 text-xs mt-0.5">{label}</p>
    </div>
  )
}
