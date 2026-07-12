import { useState, useEffect } from 'react'
import { useSplitStore } from '../store/useSplitStore'
import { loadHistory, type HistoryEntry } from '../lib/supabase'

export default function HistoryScreen() {
  const { setScreen, setLoading, loadFromSupabase } = useSplitStore()
  const [entries, setEntries] = useState<HistoryEntry[]>([])

  useEffect(() => {
    setEntries(loadHistory())
  }, [])

  const handleLoad = async (entry: HistoryEntry) => {
    setLoading(true, 'Loading split…')
    try {
      const { supabase } = await import('../lib/supabase')
      const { data, error } = await supabase
        .from('receipt_splits')
        .select('*')
        .eq('id', entry.id)
        .single()
      if (error || !data) throw new Error(error?.message ?? 'Not found')
      loadFromSupabase(data)
    } catch (err: unknown) {
      alert('Failed to load split.\n\n' + (err as Error).message)
      setLoading(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Recent splits</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Last 5 days</p>
        </div>
        <button
          onClick={() => setScreen('upload')}
          className="text-sm text-emerald-500 font-semibold hover:text-emerald-600 transition-colors"
        >
          ← Back
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm px-4 py-8 text-center text-gray-400 text-sm">
          No recent splits found
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map(entry => (
            <button
              key={entry.id}
              onClick={() => handleLoad(entry)}
              className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm px-4 py-3 text-left hover:ring-2 hover:ring-emerald-500 transition-all active:scale-[.98]"
            >
              <div className="flex items-baseline justify-between">
                <span className="font-semibold text-sm">
                  {entry.people.join(', ')}
                </span>
                <span className="text-sm font-bold">${entry.total.toFixed(2)}</span>
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {new Date(entry.created_at).toLocaleDateString(undefined, {
                  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                })}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
