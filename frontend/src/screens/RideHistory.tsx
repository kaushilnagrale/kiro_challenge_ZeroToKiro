import { useStore } from '../store'
import { RiskBadge } from '../components/RiskBadge'

export function RideHistory() {
  const { rideHistory, setScreen } = useStore()

  const totalRides = rideHistory.length
  const totalKm = rideHistory.reduce((s, r) => s + r.distance_km, 0)
  const totalStops = rideHistory.reduce((s, r) => s + r.water_stops_taken, 0)
  const avgExposure = totalRides
    ? Math.round(rideHistory.reduce((s, r) => s + r.exposure_deg_min, 0) / totalRides)
    : 0

  return (
    <div className="flex flex-col h-full pb-20 overflow-y-auto scrollbar-hide">
      <div className="px-5 pt-10 pb-4">
        <h2 className="text-2xl font-bold text-white">Ride History</h2>
        <p className="text-white/40 text-sm mt-0.5">Your thermal exposure log</p>
      </div>

      {/* Stats summary */}
      <div className="mx-5 mb-5 grid grid-cols-2 gap-3">
        <StatCard icon="🚴" label="Total rides" value={`${totalRides}`} />
        <StatCard icon="📍" label="Total km" value={`${totalKm.toFixed(1)}`} />
        <StatCard icon="💧" label="Water stops" value={`${totalStops}`} />
        <StatCard icon="🌡️" label="Avg exposure" value={`${avgExposure} °C·min`} />
      </div>

      {/* Ride list */}
      {rideHistory.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center px-8">
          <span className="text-5xl">🚴</span>
          <p className="text-white/40 text-sm">No rides yet. Plan your first route!</p>
          <button onClick={() => setScreen('planner')} className="text-orange text-sm underline">
            Go to Planner
          </button>
        </div>
      ) : (
        <div className="px-5 space-y-3">
          {rideHistory.map((r) => (
            <RideCard key={r.id} ride={r} />
          ))}
        </div>
      )}
    </div>
  )
}

function RideCard({ ride }: { ride: import('../types').RideRecord }) {
  const date = new Date(ride.date)
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="bg-surface rounded-2xl p-4 border border-border">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-white font-medium text-sm">{ride.origin}</p>
          <p className="text-white/40 text-xs">→ {ride.destination}</p>
        </div>
        <div className="text-right">
          <p className="text-white/60 text-xs">{dateStr}</p>
          <p className="text-white/30 text-xs">{timeStr}</p>
        </div>
      </div>

      <div className="flex gap-3 text-xs text-white/60 mb-3">
        <span>{ride.distance_km} km</span>
        <span>·</span>
        <span>{ride.duration_min} min</span>
        <span>·</span>
        <span className={ride.route_type === 'pulseroute' ? 'text-orange' : 'text-blue'}>
          {ride.route_type === 'pulseroute' ? '🌿 PulseRoute' : '⚡ Fastest'}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-3 text-xs">
          <span className="text-white/50">🌡️ {ride.exposure_deg_min} °C·min</span>
          <span className="text-blue">💧 {ride.water_stops_taken} stops</span>
        </div>
        <RiskBadge level={ride.peak_risk} />
      </div>
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="bg-surface rounded-2xl p-4 border border-border">
      <span className="text-2xl">{icon}</span>
      <p className="text-white font-bold text-xl mt-2">{value}</p>
      <p className="text-white/40 text-xs mt-0.5">{label}</p>
    </div>
  )
}
