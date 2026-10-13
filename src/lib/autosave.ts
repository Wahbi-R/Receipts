import { useSplitStore, isDirty } from '../store/useSplitStore'
import { saveSplit } from './supabase'

const DEBOUNCE_MS = 1000

let timer: ReturnType<typeof setTimeout> | null = null
let inFlight = false

/** Save now if this device has changes the shared split doesn't have yet. */
export async function flushSave(): Promise<void> {
  if (timer) { clearTimeout(timer); timer = null }
  const state = useSplitStore.getState()
  if (inFlight || !state.splitId || !isDirty(state)) return
  inFlight = true
  try {
    await saveSplit()
  } catch (err) {
    console.warn('Autosave failed:', err)
  } finally {
    inFlight = false
  }
  // More edits may have landed while the request was out
  const after = useSplitStore.getState()
  if (after.saveState !== 'error' && isDirty(after)) scheduleSave()
}

function scheduleSave() {
  if (timer) clearTimeout(timer)
  timer = setTimeout(flushSave, DEBOUNCE_MS)
}

/**
 * Once a split has a link, every edit (items, people, assignments, approvals,
 * paid) saves itself shortly after the last change. Returns a cleanup fn.
 */
export function startAutosave(): () => void {
  const unsubscribe = useSplitStore.subscribe(state => {
    if (state.splitId && isDirty(state) && state.saveState !== 'saving') scheduleSave()
  })
  const onOnline = () => { void flushSave() }
  const onUnload = (e: BeforeUnloadEvent) => {
    const s = useSplitStore.getState()
    if (s.splitId && (isDirty(s) || s.saveState === 'saving')) e.preventDefault()
  }
  window.addEventListener('online', onOnline)
  window.addEventListener('beforeunload', onUnload)
  return () => {
    unsubscribe()
    window.removeEventListener('online', onOnline)
    window.removeEventListener('beforeunload', onUnload)
  }
}
