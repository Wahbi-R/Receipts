import { useState, useRef } from 'react'
import { useSplitStore } from '../store/useSplitStore'

export default function PeopleScreen() {
  const people = useSplitStore(s => s.people)
  const { addPerson, removePerson, setScreen } = useSplitStore()
  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleAdd = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    addPerson(trimmed)
    setName('')
    inputRef.current?.focus()
  }

  const handleNext = () => {
    if (!people.length) { alert('Add at least one person first'); return }
    setScreen('assign')
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Who's splitting?</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Add everyone at the table</p>
      </div>

      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
          placeholder="Enter a name…"
          maxLength={24}
          className="flex-1 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-3 text-base outline-none focus:border-emerald-500 transition-colors"
        />
        <button
          onClick={handleAdd}
          className="px-5 py-3 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-600 active:scale-[.98] transition-all"
        >
          Add
        </button>
      </div>

      {people.length > 0 && (
        <div className="flex flex-wrap gap-2 min-h-12">
          {people.map(person => (
            <div
              key={person.id}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-sm font-semibold"
              style={{ backgroundColor: person.color }}
            >
              <span>{person.name}</span>
              <button
                onClick={() => removePerson(person.id)}
                className="w-4 h-4 rounded-full bg-white/30 hover:bg-white/50 flex items-center justify-center text-[10px] leading-none transition-colors"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={handleNext}
        className="w-full py-3.5 rounded-xl bg-emerald-500 text-white font-semibold text-base hover:bg-emerald-600 active:scale-[.98] transition-all"
      >
        Assign Items →
      </button>
    </div>
  )
}
