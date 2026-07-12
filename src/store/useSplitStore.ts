import { create } from 'zustand'
import type { Item, Receipt, Person, Assignments, Screen, SupabaseSplit } from '../types'

export const PERSON_COLORS = [
  '#EF4444', '#3B82F6', '#10B981', '#F59E0B',
  '#8B5CF6', '#EC4899', '#06B6D4', '#F97316',
]

const emptyReceipt = (): Receipt => ({
  items: [], subtotal: 0, tax: 0, tip: 0, total: 0,
})

interface SplitStore {
  screen: Screen
  loading: boolean
  loadingMsg: string
  imageBase64: string | null
  mediaType: string
  receipt: Receipt
  people: Person[]
  assignments: Assignments
  splitId: string | null
  isSharedSplit: boolean
  _nextItemId: number
  _nextPersonId: number

  setScreen(screen: Screen): void
  setLoading(loading: boolean, msg?: string): void
  setImage(base64: string, mediaType: string): void
  setReceipt(receipt: Receipt): void
  updateItemField(id: number, field: keyof Pick<Item, 'name' | 'quantity' | 'total_price'>, value: string | number): void
  removeItem(id: number): void
  addItem(): void
  updateMeta(field: 'subtotal' | 'tax' | 'tip', value: number): void
  addPerson(name: string): void
  removePerson(id: number): void
  toggleAssignment(itemId: number, personId: number): void
  assignAll(): void
  setSplitId(id: string): void
  loadFromSupabase(data: SupabaseSplit): void
  reset(): void
}

export const useSplitStore = create<SplitStore>((set, _get) => ({
  screen: 'upload',
  loading: false,
  loadingMsg: 'Loading…',
  imageBase64: null,
  mediaType: 'image/jpeg',
  receipt: emptyReceipt(),
  people: [],
  assignments: {},
  splitId: null,
  isSharedSplit: false,
  _nextItemId: 0,
  _nextPersonId: 0,

  setScreen: (screen) => set({ screen }),

  setLoading: (loading, msg = 'Loading…') => set({ loading, loadingMsg: msg }),

  setImage: (base64, mediaType) => set({ imageBase64: base64, mediaType }),

  setReceipt: (receipt) => {
    const assignments: Assignments = {}
    receipt.items.forEach(item => { assignments[item.id] = [] })
    set({ receipt, assignments, splitId: null, isSharedSplit: false })
  },

  updateItemField: (id, field, value) => set(s => ({
    receipt: {
      ...s.receipt,
      items: s.receipt.items.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    },
  })),

  removeItem: (id) => set(s => {
    const assignments = { ...s.assignments }
    delete assignments[id]
    return {
      receipt: { ...s.receipt, items: s.receipt.items.filter(i => i.id !== id) },
      assignments,
    }
  }),

  addItem: () => set(s => {
    const id = s._nextItemId
    return {
      receipt: {
        ...s.receipt,
        items: [...s.receipt.items, { id, name: 'New item', quantity: 1, unit_price: 0, total_price: 0 }],
      },
      assignments: { ...s.assignments, [id]: [] },
      _nextItemId: id + 1,
    }
  }),

  updateMeta: (field, value) => set(s => ({
    receipt: { ...s.receipt, [field]: value },
  })),

  addPerson: (name) => set(s => {
    if (s.people.length >= 8) return s
    const id = s._nextPersonId
    return {
      people: [...s.people, { id, name, color: PERSON_COLORS[s.people.length] }],
      _nextPersonId: id + 1,
    }
  }),

  removePerson: (id) => set(s => {
    const people = s.people
      .filter(p => p.id !== id)
      .map((p, i) => ({ ...p, color: PERSON_COLORS[i] }))
    const assignments: Assignments = {}
    Object.entries(s.assignments).forEach(([k, ids]) => {
      assignments[Number(k)] = ids.filter(pid => pid !== id)
    })
    return { people, assignments }
  }),

  toggleAssignment: (itemId, personId) => set(s => {
    const current = s.assignments[itemId] ?? []
    const next = current.includes(personId)
      ? current.filter(id => id !== personId)
      : [...current, personId]
    return { assignments: { ...s.assignments, [itemId]: next } }
  }),

  assignAll: () => set(s => {
    const personIds = s.people.map(p => p.id)
    const assignments: Assignments = {}
    s.receipt.items.forEach(item => { assignments[item.id] = [...personIds] })
    return { assignments }
  }),

  setSplitId: (id) => set({ splitId: id }),

  loadFromSupabase: (data) => {
    const assignments: Assignments = {}
    Object.entries(data.assignments ?? {}).forEach(([k, v]) => {
      assignments[Number(k)] = v
    })
    set({
      splitId: data.id,
      isSharedSplit: true,
      receipt: data.receipt,
      people: data.people,
      assignments,
      _nextItemId: data.receipt.items.length
        ? Math.max(...data.receipt.items.map(i => i.id)) + 1 : 0,
      _nextPersonId: data.people.length
        ? Math.max(...data.people.map(p => p.id)) + 1 : 0,
      screen: 'assign',
    })
  },

  reset: () => set({
    screen: 'upload',
    imageBase64: null,
    receipt: emptyReceipt(),
    people: [],
    assignments: {},
    splitId: null,
    isSharedSplit: false,
    _nextItemId: 0,
    _nextPersonId: 0,
  }),
}))

/** Per-person split calculation — used by Assign + Summary screens */
export function calcPersonTotals(
  receipt: Receipt,
  people: Person[],
  assignments: Assignments,
) {
  const subtotals: Record<number, number> = {}
  const itemLines: Record<number, { name: string; share: number }[]> = {}
  people.forEach(p => { subtotals[p.id] = 0; itemLines[p.id] = [] })

  receipt.items.forEach(item => {
    const ids = assignments[item.id] ?? []
    if (!ids.length) return
    const share = item.total_price / ids.length
    ids.forEach(pid => {
      subtotals[pid] = (subtotals[pid] ?? 0) + share
      itemLines[pid] = [...(itemLines[pid] ?? []), { name: item.name, share }]
    })
  })

  const grandSub = Object.values(subtotals).reduce((a, b) => a + b, 0)
  const extras = receipt.tax + receipt.tip

  return people.map(person => {
    const sub = subtotals[person.id] ?? 0
    const prop = grandSub > 0 ? sub / grandSub : 1 / people.length
    const extraShare = extras * prop
    return {
      person,
      items: itemLines[person.id] ?? [],
      subtotal: sub,
      extraShare,
      total: sub + extraShare,
    }
  })
}
