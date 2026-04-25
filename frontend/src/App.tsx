import { useStore } from './store'
import { Onboarding } from './screens/Onboarding'
import { RidePlanner } from './screens/RidePlanner'
import { RoutePreview } from './screens/RoutePreview'
import { LiveTracking } from './screens/LiveTracking'
import { RideHistory } from './screens/RideHistory'
import { BottomNav } from './components/BottomNav'
import { ProvenanceModal } from './components/ProvenanceModal'

export default function App() {
  const screen = useStore((s) => s.screen)

  return (
    <div className="relative flex flex-col h-full max-w-md mx-auto bg-bg overflow-hidden">
      {screen === 'onboarding' && <Onboarding />}
      {screen === 'planner'    && <RidePlanner />}
      {screen === 'preview'    && <RoutePreview />}
      {screen === 'live'       && <LiveTracking />}
      {screen === 'history'    && <RideHistory />}

      <BottomNav />
      <ProvenanceModal />
    </div>
  )
}
