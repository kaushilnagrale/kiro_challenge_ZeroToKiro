import { useStore } from './store'
import { Logo } from './components/Logo'
import { Onboarding } from './screens/Onboarding'
import { RidePlanner } from './screens/RidePlanner'
import { RoutePreview } from './screens/RoutePreview'
import { LiveTracking } from './screens/LiveTracking'
import { RideHistory } from './screens/RideHistory'
import { BottomNav } from './components/BottomNav'
import { ProvenanceModal } from './components/ProvenanceModal'

const SCREEN_TITLES: Record<string, string> = {
  planner: 'Plan',
  preview: 'Route',
  history: 'History',
}

export default function App() {
  const { screen, profile } = useStore()

  // Live and onboarding get full-bleed layouts — no header
  const showHeader = screen !== 'onboarding' && screen !== 'live'
  const title = SCREEN_TITLES[screen]

  return (
    <div className="relative flex flex-col h-full max-w-md mx-auto bg-bg overflow-hidden">

      {/* ── App header (non-live screens) ── */}
      {showHeader && (
        <header
          className="flex items-center justify-between px-5 pt-safe"
          style={{
            paddingTop: 'max(env(safe-area-inset-top), 12px)',
            paddingBottom: 12,
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            background: 'rgba(17,19,23,0.95)',
            backdropFilter: 'blur(8px)',
            position: 'sticky',
            top: 0,
            zIndex: 30,
          }}
        >
          <Logo size="sm" />
          {title && (
            <span className="text-white/40 text-xs font-medium uppercase tracking-widest">
              {title}
            </span>
          )}
          {/* Profile avatar */}
          <div
            className="w-8 h-8 rounded-full bg-orange/20 border border-orange/30 flex items-center justify-center"
            title={profile?.name ?? 'Profile'}
          >
            <span className="text-orange text-xs font-bold">
              {profile?.name?.[0]?.toUpperCase() ?? '?'}
            </span>
          </div>
        </header>
      )}

      {/* ── Screen content ── */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {screen === 'onboarding' && <Onboarding />}
        {screen === 'planner'    && <RidePlanner />}
        {screen === 'preview'    && <RoutePreview />}
        {screen === 'live'       && <LiveTracking />}
        {screen === 'history'    && <RideHistory />}
      </div>

      <BottomNav />
      <ProvenanceModal />
    </div>
  )
}
