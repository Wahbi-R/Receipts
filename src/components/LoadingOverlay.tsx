import { useState, useEffect } from 'react'
import { useSplitStore } from '../store/useSplitStore'

const SCAN_STAGES = [
  { at: 0,  msg: 'Reading receipt…'     },
  { at: 4,  msg: 'Identifying items…'   },
  { at: 9,  msg: 'Calculating totals…'  },
  { at: 15, msg: 'Almost there…'        },
]

export default function LoadingOverlay() {
  const loading = useSplitStore(s => s.loading)
  const baseMsg = useSplitStore(s => s.loadingMsg)
  const [elapsed, setElapsed] = useState(0)

  const isScanning = baseMsg === 'Scanning receipt…'

  useEffect(() => {
    if (!loading) { setElapsed(0); return }
    const t = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [loading])

  if (!loading) return null

  const displayMsg = isScanning
    ? [...SCAN_STAGES].reverse().find(s => elapsed >= s.at)?.msg ?? SCAN_STAGES[0].msg
    : baseMsg

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-black/60 backdrop-blur-sm text-white px-6">
      <div className="w-12 h-12 rounded-full border-4 border-white/25 border-t-white animate-spin" />

      <div className="flex flex-col items-center gap-1.5 text-center">
        <p className="font-semibold text-base">{displayMsg}</p>

        {isScanning && elapsed > 0 && (
          <p className="text-sm text-white/50">{elapsed}s elapsed</p>
        )}

        {isScanning && elapsed >= 20 && (
          <p className="text-xs text-white/40 max-w-xs mt-1">
            Large or complex receipts can take some time — still working on it (hopefully it didnt crash or something ☠️)...
          </p>
        )}
      </div>

      {isScanning && (
        <div className="w-48 h-1 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-white/70 rounded-full transition-all duration-1000"
            style={{ width: `${Math.min((elapsed / 25) * 100, 90)}%` }}
          />
        </div>
      )}
    </div>
  )
}
