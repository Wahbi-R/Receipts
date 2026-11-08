import { create } from 'zustand'
import { useSplitStore } from '../store/useSplitStore'

// Item names in English (translations from the scan or WabWay) or as printed.
// Per device, like the currency choice; English by default.
const PREF_KEY = 'item_names_original'
const useOriginalPref = create<{ original: boolean; toggle: () => void }>(set => ({
  original: (() => { try { return localStorage.getItem(PREF_KEY) === '1' } catch { return false } })(),
  toggle: () => set(s => {
    const original = !s.original
    try { localStorage.setItem(PREF_KEY, original ? '1' : '0') } catch { /* private mode */ }
    return { original }
  }),
}))

type Named = { name: string; name_en?: string }

/** How to show item names on this split, and the toggle between them. */
export function useItemNames() {
  const items = useSplitStore(s => s.receipt.items)
  const { original, toggle } = useOriginalPref()
  const hasTranslations = items.some(i => !!i.name_en)
  const english = hasTranslations && !original
  return {
    hasTranslations,
    english,
    toggle,
    /** The name to show. */
    name: (i: Named) => (english && i.name_en ? i.name_en : i.name),
    /** The printed name, to show small under a translation (else null). */
    printed: (i: Named) => (english && i.name_en ? i.name : null),
  }
}
