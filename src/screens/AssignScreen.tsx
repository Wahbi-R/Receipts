import { useEffect, useRef } from 'react'
import { useSplitStore, calcPersonTotals } from '../store/useSplitStore'
import { saveSplit } from '../lib/supabase'

export default function AssignScreen() {
  const receipt = useSplitStore(s => s.receipt)
  const people = useSplitStore(s => s.people)
  const assignments = useSplitStore(s => s.assignments)
  const isShared = useSplitStore(s => s.isSharedSplit)
  const { toggleAssignment, assignAll, setScreen } = useSplitStore()

  const totals = calcPersonTotals(receipt, people, assignments)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-save shared splits 1.5 s after any assignment change
  useEffect(() => {
    if (!isShared) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const { receipt, people, assignments, splitId } = useSplitStore.getState()
      saveSplit(receipt, people, assignments, splitId ?? undefined).catch(console.warn)
    }, 1500)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [assignments, isShared])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Assign items</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Tap names next to each item</p>
        </div>
        <button
          onClick={assignAll}
          className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 font-semibold transition-colors"
        >
          All → Everyone
        </button>
      </div>

      {/* Item rows */}
      <div className="flex flex-col gap-2">
        {receipt.items.map(item => {
          const assigned = assignments[item.id] ?? []
          return (
            <div key={item.id} className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm px-4 py-3">
              <div className="flex items-baseline justify-between mb-2">
                <span className="font-medium text-sm leading-tight">{item.name}</span>
                <span className="text-sm font-semibold ml-2 shrink-0">
                  ${item.total_price.toFixed(2)}
                  {assigned.length > 1 && (
                    <span className="text-xs font-normal text-gray-400 ml-1">
                      ÷{assigned.length} = ${(item.total_price / assigned.length).toFixed(2)} ea
                    </span>
                  )}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {people.map(person => {
                  const active = assigned.includes(person.id)
                  return (
                    <button
                      key={person.id}
                      onClick={() => toggleAssignment(item.id, person.id)}
                      className="px-2.5 py-1 rounded-full text-xs font-semibold border-2 transition-all active:scale-95"
                      style={{
                        borderColor: person.color,
                        backgroundColor: active ? person.color : 'transparent',
                        color: active ? '#fff' : person.color,
                      }}
                    >
                      {person.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Per-person running totals */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
        <div className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Running totals (incl. tax & tip)
        </div>
        {totals.map(({ person, total }) => (
          <div key={person.id} className="flex items-center px-4 py-2 border-t border-gray-100 dark:border-gray-700 first:border-0">
            <span
              className="w-2.5 h-2.5 rounded-full mr-2 shrink-0"
              style={{ backgroundColor: person.color }}
            />
            <span className="flex-1 text-sm">{person.name}</span>
            <span className="font-semibold text-sm">${total.toFixed(2)}</span>
          </div>
        ))}
      </div>

      <button
        onClick={() => setScreen('summary')}
        className="w-full py-3.5 rounded-xl bg-emerald-500 text-white font-semibold text-base hover:bg-emerald-600 active:scale-[.98] transition-all"
      >
        View Summary →
      </button>
    </div>
  )
}
