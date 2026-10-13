import { useEffect, useState } from 'react'
import { useSplitStore } from '../store/useSplitStore'

const FLASH_MS = 2500

/** Ids of people or items that just changed live, for a brief highlight. */
export function useFlash(kind: 'people' | 'items'): Set<number> {
  const flash = useSplitStore(s => s.flash)
  const [ids, setIds] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (!flash || Date.now() - flash.at > FLASH_MS) return
    setIds(new Set(flash[kind]))
    const t = setTimeout(() => setIds(new Set()), FLASH_MS)
    return () => clearTimeout(t)
  }, [flash, kind])

  return ids
}

export const FLASH_CLASS = 'ring-2 ring-emerald-400 transition-shadow duration-700'
