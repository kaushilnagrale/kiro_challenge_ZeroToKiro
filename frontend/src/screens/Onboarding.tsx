import { useState } from 'react'
import { useStore } from '../store'
import { Logo } from '../components/Logo'
import { MOCK_HISTORY } from '../lib/mockData'

type Step = 'welcome' | 'connect' | 'form'
type AppId = 'strava' | 'apple' | 'garmin' | 'wahoo' | 'polar' | 'none'

// ── Demo profiles per app ─────────────────────────────────────────────────────
const DEMO_PROFILES: Record<Exclude<AppId, 'none'>, {
  name: string; fitness_level: string; resting_hr: number
  hrv_baseline: number; ytd_miles: number; avatar: string
  color: string; label: string
}> = {
  strava: {
    name: 'Praveen Salapu', fitness_level: 'Intermediate',
    resting_hr: 65, hrv_baseline: 55, ytd_miles: 892,
    avatar: '🚴', color: '#FC4C02', label: 'Strava',
  },
  apple: {
    name: 'Praveen Salapu', fitness_level: 'Advanced',
    resting_hr: 58, hrv_baseline: 68, ytd_miles: 1240,
    avatar: '🍎', color: '#ffffff', label: 'Apple Fitness',
  },
  garmin: {
    name: 'Praveen Salapu', fitness_level: 'Intermediate',
    resting_hr: 62, hrv_baseline: 60, ytd_miles: 670,
    avatar: '⌚', color: '#007CC3', label: 'Garmin Connect',
  },
  wahoo: {
    name: 'Praveen Salapu', fitness_level: 'Advanced',
    resting_hr: 55, hrv_baseline: 72, ytd_miles: 1580,
    avatar: '🔴', color: '#E8003D', label: 'Wahoo',
  },
  polar: {
    name: 'Praveen Salapu', fitness_level: 'Beginner',
    resting_hr: 70, hrv_baseline: 48, ytd_miles: 320,
    avatar: '🐻‍❄️', color: '#D5001C', label: 'Polar Flow',
  },
}

// ── App tiles shown on the connect screen ─────────────────────────────────────
const FITNESS_APPS: { id: Exclude<AppId, 'none'>; icon: string; label: string; sub: string; color: string }[] = [
  { id: 'strava',  icon: '🏃', label: 'Strava',         sub: 'Rides, HR zones & fitness level', color: '#FC4C02' },
  { id: 'apple',   icon: '🍎', label: 'Apple Fitness',  sub: 'HealthKit HR, HRV & workouts',    color: '#ffffff' },
  { id: 'garmin',  icon: '⌚', label: 'Garmin Connect', sub: 'Training load & VO₂ max',         color: '#007CC3' },
  { id: 'wahoo',   icon: '🔴', label: 'Wahoo',          sub: 'Power, HR & cycling metrics',     color: '#E8003D' },
  { id: 'polar',   icon: '🐻‍❄️', label: 'Polar Flow',    sub: 'Nightly recovery & HRV trend',   color: '#D5001C' },
]

export function Onboarding() {
  const { setProfile, setScreen, addRideRecord } = useStore()
  const [step, setStep] = useState<Step>('welcome')
  const [connecting, setConnecting] = useState<AppId | null>(null)
  const [connected, setConnected] = useState<AppId | null>(null)
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [weight, setWeight] = useState('')
  const [sensitive, setSensitive] = useState(false)

  // Simulate OAuth for any app
  async function handleConnect(appId: Exclude<AppId, 'none'>) {
    setConnecting(appId)
    await new Promise((r) => setTimeout(r, 1400))
    setConnected(appId)
    setConnecting(null)
    const p = DEMO_PROFILES[appId]
    setName(p.name)
    setAge('28')
    setWeight('165')
  }

  function handleContinueConnected() {
    if (!connected || connected === 'none') return
    const p = DEMO_PROFILES[connected]
    setProfile({
      name: p.name,
      age: 28,
      weight_kg: 75,
      sensitive_mode: false,
      baseline_hr: p.resting_hr,
    })
    MOCK_HISTORY.forEach((r) => addRideRecord(r))
    setScreen('planner')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const baseHr = connected && connected !== 'none'
      ? DEMO_PROFILES[connected].resting_hr
      : 65
    setProfile({
      name: name || 'Praveen',
      age: parseInt(age) || 28,
      weight_kg: parseInt(weight) || 75,
      sensitive_mode: sensitive,
      baseline_hr: baseHr,
    })
    MOCK_HISTORY.forEach((r) => addRideRecord(r))
    setScreen('planner')
  }

  // ── Welcome ─────────────────────────────────────────────────────────────────
  if (step === 'welcome') {
    return (
      <div className="flex flex-col items-center justify-between h-full px-6 py-12 text-center">
        <div />
        <div className="w-full">
          <div className="flex justify-center mb-8">
            <Logo size="lg" />
          </div>
          <p className="text-white/60 text-base leading-relaxed max-w-xs mx-auto">
            The cycling co-pilot that keeps you cool, hydrated, and safe in the heat.
          </p>
          <div className="mt-8 space-y-3 text-left">
            {[
              { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffb693" strokeWidth="2" strokeLinecap="round"><path d="M3 17l4-8 4 4 4-6 4 10"/></svg>, text: 'Routes optimized for shade & MRT' },
              { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round"><path d="M12 22V12M12 12C12 12 7 9 7 5a5 5 0 0 1 10 0c0 4-5 7-5 7z"/></svg>, text: 'Water stops before you need them' },
              { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>, text: 'Biosignal monitoring for heat stress' },
              { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>, text: 'Every alert cites its data sources' },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-3 bg-surface rounded-xl px-4 py-3">
                <span className="shrink-0">{f.icon}</span>
                <span className="text-white/80 text-sm">{f.text}</span>
              </div>
            ))}
          </div>
        </div>
        <button
          onClick={() => setStep('connect')}
          className="w-full py-4 rounded-2xl bg-orange text-bg font-semibold text-base"
        >
          Get Started
        </button>
      </div>
    )
  }

  // ── Connect fitness app ──────────────────────────────────────────────────────
  if (step === 'connect') {
    const connectedProfile = connected && connected !== 'none' ? DEMO_PROFILES[connected] : null

    return (
      <div className="flex flex-col h-full px-6 py-10 overflow-y-auto scrollbar-hide">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-1">Connect your fitness app</h2>
          <p className="text-white/50 text-sm">
            Import HR zones & fitness level for personalized heat risk thresholds
          </p>
        </div>

        {/* Connected state */}
        {connectedProfile ? (
          <div className="mb-5">
            <div
              className="rounded-2xl p-5 border mb-4"
              style={{ borderColor: `${connectedProfile.color}66`, background: `${connectedProfile.color}11` }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
                  style={{ background: `${connectedProfile.color}22` }}
                >
                  {connectedProfile.avatar}
                </div>
                <div>
                  <p className="text-white font-semibold">{connectedProfile.name}</p>
                  <p className="text-xs font-medium" style={{ color: connectedProfile.color }}>
                    ✓ {connectedProfile.label} connected
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <StatChip label="Fitness" value={connectedProfile.fitness_level} />
                <StatChip label="Resting HR" value={`${connectedProfile.resting_hr} bpm`} />
                <StatChip label="YTD Miles" value={`${connectedProfile.ytd_miles}`} />
              </div>
              <div className="bg-green/10 border border-green/30 rounded-xl px-3 py-2">
                <p className="text-green text-xs">
                  ✓ Thresholds personalized for {connectedProfile.fitness_level.toLowerCase()} rider
                </p>
              </div>
            </div>

            <button
              onClick={handleContinueConnected}
              className="w-full py-4 rounded-2xl bg-orange text-bg font-semibold text-base mb-3"
            >
              Start Riding →
            </button>
            <button
              onClick={() => setConnected(null)}
              className="w-full text-white/30 text-sm text-center py-2"
            >
              Connect a different app
            </button>
          </div>
        ) : (
          <>
            {/* App tiles */}
            <div className="space-y-3 mb-5">
              {FITNESS_APPS.map((app) => (
                <button
                  key={app.id}
                  onClick={() => handleConnect(app.id)}
                  disabled={connecting !== null}
                  className="w-full bg-surface rounded-2xl p-4 border border-border flex items-center gap-4 text-left transition-opacity disabled:opacity-60"
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
                    style={{ background: `${app.color}22` }}
                  >
                    {connecting === app.id ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      app.icon
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm">{app.label}</p>
                    <p className="text-white/40 text-xs mt-0.5">{app.sub}</p>
                  </div>
                  <span className="text-white/30 text-sm shrink-0">
                    {connecting === app.id ? 'Connecting…' : '→'}
                  </span>
                </button>
              ))}
            </div>

            {/* What gets imported */}
            <div className="bg-surface rounded-2xl p-4 border border-border mb-5">
              <p className="text-white/50 text-xs font-medium mb-2 uppercase tracking-wider">What gets imported</p>
              <div className="space-y-1.5">
                {[
                  '✓ Resting HR & HRV baseline',
                  '✓ Fitness level classification',
                  '✓ Personalized heat risk thresholds',
                  '✓ Recent ride history',
                ].map((t) => (
                  <p key={t} className="text-white/60 text-xs">{t}</p>
                ))}
              </div>
            </div>

            {/* Skip */}
            <button
              onClick={() => setStep('form')}
              className="w-full text-white/30 text-sm text-center py-3 border border-border rounded-2xl"
            >
              Skip — enter profile manually
            </button>
          </>
        )}
      </div>
    )
  }

  // ── Manual profile form ──────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full px-6 py-10 overflow-y-auto scrollbar-hide">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-1">Rider Profile</h2>
        <p className="text-white/50 text-sm">Personalizes your risk thresholds</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5 flex-1">
        <Field label="Name" placeholder="e.g. Alex" value={name} onChange={setName} />
        <Field label="Age" placeholder="25" value={age} onChange={setAge} type="number" />
        <Field label="Weight (lbs)" placeholder="165" value={weight} onChange={setWeight} type="number" />

        <div className="bg-surface rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-white font-medium text-sm">Sensitive Mode</p>
            <p className="text-white/40 text-xs mt-0.5">Stricter thresholds for kids, elderly, cardiac</p>
          </div>
          <button
            type="button"
            onClick={() => setSensitive(!sensitive)}
            className={`w-12 h-6 rounded-full transition-colors relative ${sensitive ? 'bg-orange' : 'bg-border'}`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                sensitive ? 'translate-x-6' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        <div className="mt-auto pt-4">
          <button
            type="submit"
            className="w-full py-4 rounded-2xl bg-orange text-bg font-semibold text-base"
          >
            Start Riding
          </button>
        </div>
      </form>
    </div>
  )
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-bg rounded-xl p-2.5 text-center">
      <p className="text-white font-semibold text-sm">{value}</p>
      <p className="text-white/40 text-xs mt-0.5">{label}</p>
    </div>
  )
}

function Field({
  label, placeholder, value, onChange, type = 'text',
}: {
  label: string; placeholder: string; value: string
  onChange: (v: string) => void; type?: string
}) {
  return (
    <div>
      <label className="block text-white/60 text-xs font-medium mb-1.5">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-orange"
      />
    </div>
  )
}
