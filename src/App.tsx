import { useEffect } from 'react'
import { useSplitStore } from './store/useSplitStore'
import { checkUrlForSplit } from './lib/supabase'
import Header from './components/Header'
import LoadingOverlay from './components/LoadingOverlay'
import UploadScreen from './screens/UploadScreen'
import ItemsScreen from './screens/ItemsScreen'
import PeopleScreen from './screens/PeopleScreen'
import AssignScreen from './screens/AssignScreen'
import SummaryScreen from './screens/SummaryScreen'
import HistoryScreen from './screens/HistoryScreen'

export default function App() {
  const screen = useSplitStore(s => s.screen)

  useEffect(() => { checkUrlForSplit() }, [])

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <LoadingOverlay />
      <Header />
      <main className="max-w-md mx-auto px-4 py-5">
        {screen === 'upload'  && <UploadScreen />}
        {screen === 'items'   && <ItemsScreen />}
        {screen === 'people'  && <PeopleScreen />}
        {screen === 'assign'  && <AssignScreen />}
        {screen === 'summary' && <SummaryScreen />}
        {screen === 'history' && <HistoryScreen />}
      </main>
    </div>
  )
}
