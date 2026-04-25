import { useStore } from '../store'

// SVG icons — no emoji dependency
function IconPlan({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#ffb693' : 'rgba(255,255,255,0.35)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function IconRoute({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#ffb693' : 'rgba(255,255,255,0.35)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 17l4-8 4 4 4-6 4 10" />
    </svg>
  )
}

function IconRide({ active }: { active: boolean }) {
  const c = active ? '#ffb693' : 'rgba(255,255,255,0.35)'
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5.5" cy="17.5" r="3.5" />
      <circle cx="18.5" cy="17.5" r="3.5" />
      <path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5L9 10l3-1 2 4h4" />
    </svg>
  )
}

function IconHistory({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#ffb693' : 'rgba(255,255,255,0.35)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="14" x2="8" y2="14" strokeWidth="2.5" />
      <line x1="12" y1="14" x2="12" y2="14" strokeWidth="2.5" />
      <line x1="16" y1="14" x2="16" y2="14" strokeWidth="2.5" />
      <line x1="8" y1="18" x2="8" y2="18" strokeWidth="2.5" />
      <line x1="12" y1="18" x2="12" y2="18" strokeWidth="2.5" />
    </svg>
  )
}

const tabs = [
  { id: 'planner' as const,  label: 'Plan',    Icon: IconPlan },
  { id: 'preview' as const,  label: 'Route',   Icon: IconRoute },
  { id: 'live'    as const,  label: 'Ride',    Icon: IconRide },
  { id: 'history' as const,  label: 'History', Icon: IconHistory },
]

export function BottomNav() {
  const { screen, setScreen } = useStore()
  if (screen === 'onboarding') return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 max-w-md mx-auto"
      style={{ background: 'rgba(26,29,35,0.96)', backdropFilter: 'blur(12px)', borderTop: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="flex">
        {tabs.map((t) => {
          const active = screen === t.id
          return (
            <button
              key={t.id}
              onClick={() => setScreen(t.id)}
              className="flex-1 flex flex-col items-center pt-3 pb-4 gap-1 relative"
              aria-label={t.label}
              aria-current={active ? 'page' : undefined}
            >
              {/* Active indicator */}
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-orange" />
              )}
              <t.Icon active={active} />
              <span
                className="text-xs font-medium transition-colors"
                style={{ color: active ? '#ffb693' : 'rgba(255,255,255,0.35)' }}
              >
                {t.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
