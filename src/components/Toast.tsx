import { useEffect, useState } from 'react'
import { useSplitStore } from '../store/useSplitStore'

const SHOW_MS = 3500

/** Pop-up at the bottom when someone else changes the split. */
export default function Toast() {
  const toast = useSplitStore(s => s.toast)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!toast) return
    setVisible(true)
    const t = setTimeout(() => setVisible(false), SHOW_MS)
    return () => clearTimeout(t)
  }, [toast])

  if (!toast) return null
  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-[90vw] px-4 py-2.5 rounded-full bg-gray-900 text-white text-sm shadow-lg transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
      }`}
      role="status"
    >
      🔄 {toast.msg}
    </div>
  )
}
