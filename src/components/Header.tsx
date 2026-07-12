import { useSplitStore } from '../store/useSplitStore'
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
  const setScreen = useSplitStore(s => s.setScreen)
  const stepIdx = STEPS.findIndex(s => s.id === screen)

  return (
    <header className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="max-w-md mx-auto px-4 pt-3 pb-2 flex items-center justify-between">
        <span className="font-bold text-lg tracking-tight">🧾 Split</span>
        <button
          onClick={() => setScreen('history')}
          className="text-xl opacity-60 hover:opacity-100 transition-opacity p-1 rounded-lg"
          title="Recent splits"
        >
          🕐
        </button>
      </div>
      <div className="max-w-md mx-auto px-4 pb-2 flex gap-1">
        {STEPS.map((step, i) => (
          <div
            key={step.id}
            className={[
              'flex-1 text-center text-[0.6rem] font-semibold uppercase tracking-wide py-1 rounded-full transition-colors',
              i < stepIdx  ? 'text-emerald-500 dark:text-emerald-400' : '',
              i === stepIdx ? 'bg-emerald-500 text-white' : '',
              i > stepIdx  ? 'text-gray-400 dark:text-gray-600' : '',
            ].join(' ')}
          >
            {step.label}
          </div>
        ))}
      </div>
    </header>
  )
}
