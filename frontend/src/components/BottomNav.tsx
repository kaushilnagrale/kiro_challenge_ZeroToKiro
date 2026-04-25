import { useStore } from '../store'

const tabs = [
  { id: 'planner',  label: 'Plan',    icon: '🗺️' },
  { id: 'preview',  label: 'Route',   icon: '🛣️' },
  { id: 'live',     label: 'Ride',    icon: '🚴' },
  { id: 'history',  label: 'History', icon: '📊' },
] as const

export function BottomNav() {
  const { screen, setScreen } = useStore()
  if (screen === 'onboarding') return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-border flex max-w-md mx-auto">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => setScreen(t.id)}
          className={`flex-1 flex flex-col items-center py-3 gap-0.5 text-xs transition-colors ${
            screen === t.id ? 'text-orange' : 'text-white/40'
          }`}
        >
          <span className="text-lg leading-none">{t.icon}</span>
          <span className="font-medium">{t.label}</span>
        </button>
      ))}
    </nav>
  )
}
