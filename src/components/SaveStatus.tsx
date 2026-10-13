import { useSplitStore, isDirty } from '../store/useSplitStore'
import { flushSave } from '../lib/autosave'

/** Small pill in the header: Saving… / ✓ Saved / ⚠ Not saved – retry. Hidden until the split has a link. */
export default function SaveStatus() {
  const splitId = useSplitStore(s => s.splitId)
  const saveState = useSplitStore(s => s.saveState)
  const dirty = useSplitStore(isDirty)

  if (!splitId) return null

  if (saveState === 'error') {
    return (
      <button
        onClick={() => { void flushSave() }}
        className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300"
      >
        ⚠ Not saved – tap to retry
      </button>
    )
  }
  if (saveState === 'saving' || dirty) {
    return (
      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300">
        Saving…
      </span>
    )
  }
  return (
    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
      ✓ Saved
    </span>
  )
}
