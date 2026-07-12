import { useSplitStore, STEP_ORDER } from '../store/useSplitStore'
import type { Screen } from '../types'

const STEPS: { id: Screen; label: string }[] = [
  { id: 'upload',  label: 'Upload'  },
  { id: 'items',   label: 'Items'   },
  { id: 'people',  label: 'People'  },
  { id: 'assign',  label: 'Assign'  },
  { id: 'summary', label: 'Summary' },
]

export default function Header() {
  const screen = useSplitStore(s => s.screen)
  const maxStepIdx = useSplitStore(s => s.maxStepIdx)
  const setScreen = useSplitStore(s => s.setScreen)

  const stepIdx = STEP_ORDER.indexOf(screen)
  const canGoBack = stepIdx > 0
  const handleBack = () => { if (canGoBack) setScreen(STEP_ORDER[stepIdx - 1]) }

  return (
    <header className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="max-w-md mx-auto px-4 pt-3 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {canGoBack && (
            <button
              onClick={handleBack}
              className="text-sm text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors p-1 -ml-1 rounded-lg"
              title="Go back"
            >
              ←
            </button>
          )}
          <span className="font-bold text-lg tracking-tight">🧾 Split</span>
        </div>
        <button
          onClick={() => setScreen('history')}
          className="text-xl opacity-60 hover:opacity-100 transition-opacity p-1 rounded-lg"
          title="Recent splits"
        >
          🕐
        </button>
      </div>
      <div className="max-w-md mx-auto px-4 pb-2 flex gap-1">
        {STEPS.map((step, i) => {
          const isActive  = i === stepIdx
          const clickable = i !== stepIdx && i <= maxStepIdx
          return (
            <button
              key={step.id}
              onClick={() => clickable && setScreen(step.id)}
              disabled={!clickable && !isActive}
              className={[
                'flex-1 text-center text-[0.6rem] font-semibold uppercase tracking-wide py-1 rounded-full transition-colors',
                isActive  ? 'bg-emerald-500 text-white cursor-default' : '',
                clickable ? 'text-emerald-500 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 cursor-pointer' : '',
                !isActive && !clickable ? 'text-gray-400 dark:text-gray-600 cursor-default' : '',
              ].join(' ')}
            >
              {step.label}
            </button>
          )
        })}
      </div>
    </header>
  )
}
