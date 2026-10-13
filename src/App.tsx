import { useEffect } from 'react'
import { useSplitStore } from './store/useSplitStore'
import { checkUrlForSplit, subscribeToSplit } from './lib/supabase'
import { startAutosave } from './lib/autosave'
import Toast from './components/Toast'
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
  const splitId = useSplitStore(s => s.splitId)

  useEffect(() => { checkUrlForSplit() }, [])
  useEffect(() => startAutosave(), [])
  useEffect(() => (splitId ? subscribeToSplit(splitId) : undefined), [splitId])

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <LoadingOverlay />
      <Toast />
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
