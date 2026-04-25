import { useState } from 'react'
import { useStore } from '../store'
import { MOCK_HISTORY } from '../lib/mockData'

export function Onboarding() {
  const { setProfile, setScreen, addRideRecord } = useStore()
  const [step, setStep] = useState<'welcome' | 'form'>('welcome')
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [weight, setWeight] = useState('')
  const [sensitive, setSensitive] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setProfile({
      name: name || 'Rider',
      age: parseInt(age) || 25,
      weight_kg: parseInt(weight) || 70,
      sensitive_mode: sensitive,
      baseline_hr: 65,
    })
    // seed history
    MOCK_HISTORY.forEach((r) => addRideRecord(r))
    setScreen('planner')
  }

  if (step === 'welcome') {
    return (
      <div className="flex flex-col items-center justify-between h-full px-6 py-12 text-center">
        <div />
        <div>
          <div className="text-6xl mb-6">🚴</div>
          <h1 className="text-3xl font-bold text-orange mb-3">PulseRoute</h1>
          <p className="text-white/60 text-base leading-relaxed max-w-xs mx-auto">
            The cycling co-pilot that keeps you cool, hydrated, and safe in the heat.
          </p>

          <div className="mt-8 space-y-3 text-left">
            {[
              { icon: '🌡️', text: 'Routes optimized for shade & MRT' },
              { icon: '💧', text: 'Water stops before you need them' },
              { icon: '❤️', text: 'Biosignal monitoring for heat stress' },
              { icon: '🔒', text: 'Every alert cites its data sources' },
            ].map((f) => (
              <div key={f.text} className="flex items-center gap-3 bg-surface rounded-xl px-4 py-3">
                <span className="text-xl">{f.icon}</span>
                <span className="text-white/80 text-sm">{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => setStep('form')}
          className="w-full py-4 rounded-2xl bg-orange text-bg font-semibold text-base"
        >
          Get Started
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full px-6 py-10 overflow-y-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-1">Rider Profile</h2>
        <p className="text-white/50 text-sm">Personalizes your risk thresholds</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5 flex-1">
        <Field label="Name" placeholder="e.g. Alex" value={name} onChange={setName} />
        <Field label="Age" placeholder="25" value={age} onChange={setAge} type="number" />
        <Field label="Weight (kg)" placeholder="70" value={weight} onChange={setWeight} type="number" />

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
