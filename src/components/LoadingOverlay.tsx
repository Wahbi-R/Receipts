import { useSplitStore } from '../store/useSplitStore'

export default function LoadingOverlay() {
  const loading = useSplitStore(s => s.loading)
  const msg = useSplitStore(s => s.loadingMsg)

  if (!loading) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/60 backdrop-blur-sm text-white">
      <div className="w-11 h-11 rounded-full border-4 border-white/25 border-t-white animate-spin" />
      <p className="font-medium">{msg}</p>
    </div>
  )
}
