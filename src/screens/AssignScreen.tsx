import { useEffect, useRef } from 'react'
import { useSplitStore, calcPersonTotals } from '../store/useSplitStore'
import { saveSplit } from '../lib/supabase'

export default function AssignScreen() {
  const receipt = useSplitStore(s => s.receipt)
  const people = useSplitStore(s => s.people)
  const assignments = useSplitStore(s => s.assignments)
  const isShared = useSplitStore(s => s.isSharedSplit)
  const { toggleAssignment, setWeight, splitItemEqually, assignAll, setScreen } = useSplitStore()

  const totals = calcPersonTotals(receipt, people, assignments)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const issueItems = receipt.items.filter(item => {
    const weights = assignments[item.id] ?? {}
    const assigned = Object.values(weights)
    if (!assigned.length) return true
    const total = assigned.reduce((s, w) => s + w, 0)
    return Math.abs(total - item.quantity) > 0.02
  })
  const hasIssues = issueItems.length > 0

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
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Tap names, adjust portions if needed</p>
        </div>
        <button
          onClick={assignAll}
          className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 font-semibold transition-colors"
        >
          Split All Equally
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {receipt.items.map(item => {
          const weights = assignments[item.id] ?? {}
          const assignedPeople = people.filter(p => weights[p.id] !== undefined)
          const totalWeight = assignedPeople.reduce((s, p) => s + weights[p.id], 0)
          const isUnequal = assignedPeople.some(p => weights[p.id] !== weights[assignedPeople[0]?.id])
          const totalMismatch = Math.abs(totalWeight - item.quantity) > 0.01

          return (
            <div key={item.id} className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm px-4 py-3">
              {/* Item header */}
              <div className="flex items-baseline justify-between mb-2">
                <span className="font-medium text-sm leading-tight">
                  {item.name}
                  {item.quantity > 1 && (
                    <span className="ml-1.5 text-xs font-normal text-gray-400">×{item.quantity}</span>
                  )}
                </span>
                <span className="text-sm font-semibold ml-2 shrink-0">
                  ${item.total_price.toFixed(2)}
                </span>
              </div>

              {/* Person toggle buttons */}
              <div className="flex flex-wrap gap-1.5">
                {people.map(person => {
                  const active = weights[person.id] !== undefined
                  const w = weights[person.id] ?? 0
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
                      {active && w !== 1 && (
                        <span className="ml-1 opacity-80">×{w}</span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Portion inputs — shown when 2+ people assigned */}
              {assignedPeople.length >= 2 && (
                <div className="mt-2.5 pt-2.5 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase tracking-wide font-semibold text-gray-400">Portions</span>
                      <span className={`text-[10px] font-semibold ${totalMismatch ? 'text-amber-500' : 'text-gray-400'}`}>
                        {totalWeight % 1 === 0 ? totalWeight : totalWeight.toFixed(2)} of {item.quantity}
                      </span>
                      {isUnequal && !totalMismatch && (
                        <span className="text-[10px] text-gray-400">
                          · ${(item.total_price / totalWeight).toFixed(2)} ea
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => splitItemEqually(item.id)}
                      className="text-[10px] font-semibold text-emerald-500 hover:text-emerald-600 transition-colors"
                    >
                      Split equally
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {assignedPeople.map(person => (
                      <div key={person.id} className="flex items-center gap-1">
                        <span
                          className="text-xs font-semibold"
                          style={{ color: person.color }}
                        >
                          {person.name}
                        </span>
                        <input
                          type="number"
                          value={weights[person.id]}
                          min={0}
                          step={0.5}
                          onChange={e => {
                            const v = parseFloat(e.target.value)
                            setWeight(item.id, person.id, isNaN(v) ? 0 : v)
                          }}
                          className="w-12 text-center text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 py-0.5 outline-none focus:border-emerald-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Per-person share preview when unequal */}
              {isUnequal && assignedPeople.length >= 2 && (
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                  {assignedPeople.map(person => (
                    <span key={person.id} className="text-[11px] text-gray-400">
                      <span style={{ color: person.color }}>{person.name}</span>
                      {' '}${((weights[person.id] / totalWeight) * item.total_price).toFixed(2)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Running totals */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
        <div className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Running totals (incl. tax & tip)
        </div>
        {totals.map(({ person, total }) => (
          <div key={person.id} className="flex items-center px-4 py-2 border-t border-gray-100 dark:border-gray-700 first:border-0">
            <span className="w-2.5 h-2.5 rounded-full mr-2 shrink-0" style={{ backgroundColor: person.color }} />
            <span className="flex-1 text-sm">{person.name}</span>
            <span className="font-semibold text-sm">${total.toFixed(2)}</span>
          </div>
        ))}
        <div className="flex items-center px-4 py-2.5 border-t-2 border-gray-200 dark:border-gray-600">
          <span className="flex-1 text-sm font-bold">Grand total</span>
          <span className="font-bold text-sm">${totals.reduce((s, t) => s + t.total, 0).toFixed(2)}</span>
        </div>
      </div>

      {hasIssues && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-300">
          ⚠ {issueItems.length} item{issueItems.length > 1 ? 's' : ''} not fully assigned
        </div>
      )}

      <button
        onClick={() => {
          if (!hasIssues) { setScreen('summary'); return }
          if (window.confirm(`${issueItems.length} item${issueItems.length > 1 ? 's are' : ' is'} not fully assigned. Continue to summary anyway?`)) {
            setScreen('summary')
          }
        }}
        className={`w-full py-3.5 rounded-xl font-semibold text-base active:scale-[.98] transition-all text-white ${
          hasIssues ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-500 hover:bg-emerald-600'
        }`}
      >
        {hasIssues ? `View Summary (${issueItems.length} unassigned) →` : 'View Summary →'}
      </button>
    </div>
  )
}
