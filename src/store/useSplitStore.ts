import { create } from 'zustand'
import type { Item, Receipt, Person, Assignments, Screen, SupabaseSplit, HistoryEntry } from '../types'

export const PERSON_COLORS = [
  '#EF4444', '#3B82F6', '#10B981', '#F59E0B',
  '#8B5CF6', '#EC4899', '#06B6D4', '#F97316',
]

const emptyReceipt = (): Receipt => ({
  items: [], subtotal: 0, discount: 0, tax: 0, tip: 0, total: 0,
})

export const STEP_ORDER: Screen[] = ['upload', 'items', 'people', 'assign', 'summary']

function splitEqually(quantity: number, pids: number[]): Record<number, number> {
  const n = pids.length
  if (!n) return {}
  const base = Math.floor((quantity / n) * 100) / 100
  const last = Math.round((quantity - base * (n - 1)) * 100) / 100
  const w: Record<number, number> = {}
  pids.forEach((pid, i) => { w[pid] = i < n - 1 ? base : last })
  return w
}

interface SplitStore {
  screen: Screen
  maxStepIdx: number
  loading: boolean
  loadingMsg: string
  imageBase64: string | null
  mediaType: string
  receipt: Receipt
  scannedSubtotal: number
  people: Person[]
  assignments: Assignments
  approvals: Record<number, boolean>
  paid: Record<number, boolean>
  history: HistoryEntry[]
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
  setTitle(title: string): void
  updateMeta(field: 'subtotal' | 'discount' | 'tax' | 'tip', value: number): void
  addPerson(name: string): void
  removePerson(id: number): void
  toggleAssignment(itemId: number, personId: number): void
  setWeight(itemId: number, personId: number, weight: number): void
  splitItemEqually(itemId: number): void
  assignAll(): void
  setApproval(personId: number, value: boolean): void
  setPaid(personId: number, value: boolean): void
  addHistory(msg: string): void
  setSplitId(id: string): void
  loadFromSupabase(data: SupabaseSplit): void
  reset(): void
}

export const useSplitStore = create<SplitStore>((set, _get) => ({
  screen: 'upload',
  maxStepIdx: 0,
  loading: false,
  loadingMsg: 'Loading…',
  imageBase64: null,
  mediaType: 'image/jpeg',
  receipt: emptyReceipt(),
  scannedSubtotal: 0,
  people: [],
  assignments: {},
  approvals: {},
  paid: {},
  history: [],
  splitId: null,
  isSharedSplit: false,
  _nextItemId: 0,
  _nextPersonId: 0,

  setScreen: (screen) => set(s => {
    const idx = STEP_ORDER.indexOf(screen)
    return { screen, maxStepIdx: idx > s.maxStepIdx ? idx : s.maxStepIdx }
  }),

  setLoading: (loading, msg = 'Loading…') => set({ loading, loadingMsg: msg }),

  setImage: (base64, mediaType) => set({ imageBase64: base64, mediaType }),

  setReceipt: (receipt) => {
    const assignments: Assignments = {}
    receipt.items.forEach(item => { assignments[item.id] = {} })
    set({ receipt, scannedSubtotal: receipt.subtotal, assignments, splitId: null, isSharedSplit: false })
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
      assignments: { ...s.assignments, [id]: {} },
      _nextItemId: id + 1,
    }
  }),

  setTitle: (title) => set(s => ({ receipt: { ...s.receipt, title } })),

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
    Object.entries(s.assignments).forEach(([k, weights]) => {
      const next = { ...weights }
      delete next[id]
      assignments[Number(k)] = next
    })
    return { people, assignments }
  }),

  toggleAssignment: (itemId, personId) => set(s => {
    const item = s.receipt.items.find(i => i.id === itemId)
    const weights = { ...(s.assignments[itemId] ?? {}) }
    if (weights[personId] !== undefined) {
      delete weights[personId]
      return { assignments: { ...s.assignments, [itemId]: weights } }
    }
    weights[personId] = 1
    const assigned = Object.keys(weights).map(Number)
    if (item && assigned.length > item.quantity) {
      const equal = splitEqually(item.quantity, assigned)
      return { assignments: { ...s.assignments, [itemId]: equal } }
    }
    return { assignments: { ...s.assignments, [itemId]: weights } }
  }),

  setWeight: (itemId, personId, weight) => set(s => {
    const weights = { ...(s.assignments[itemId] ?? {}) }
    if (weight <= 0) {
      delete weights[personId]
    } else {
      weights[personId] = weight
    }
    return { assignments: { ...s.assignments, [itemId]: weights } }
  }),

  splitItemEqually: (itemId) => set(s => {
    const item = s.receipt.items.find(i => i.id === itemId)
    if (!item) return s
    const weights = s.assignments[itemId] ?? {}
    const assigned = Object.keys(weights).map(Number)
    if (!assigned.length) return s
    return { assignments: { ...s.assignments, [itemId]: splitEqually(item.quantity, assigned) } }
  }),

  assignAll: () => set(s => {
    const n = s.people.length
    if (!n) return s
    const assignments: Assignments = {}
    s.receipt.items.forEach(item => {
      assignments[item.id] = splitEqually(item.quantity, s.people.map(p => p.id))
    })
    return { assignments }
  }),

  setApproval: (personId, value) => set(s => ({
    approvals: { ...s.approvals, [personId]: value },
  })),

  setPaid: (personId, value) => set(s => ({
    paid: { ...s.paid, [personId]: value },
  })),

  addHistory: (msg) => set(s => ({
    history: [...s.history, { ts: new Date().toISOString(), msg }],
  })),

  setSplitId: (id) => set({ splitId: id }),

  loadFromSupabase: (data) => {
    const assignments: Assignments = {}
    Object.entries(data.assignments ?? {}).forEach(([k, v]) => {
      const weights: Record<number, number> = {}
      Object.entries(v).forEach(([pid, w]) => { weights[Number(pid)] = w })
      assignments[Number(k)] = weights
    })
    const approvals: Record<number, boolean> = {}
    Object.entries(data.approvals ?? {}).forEach(([k, v]) => { approvals[Number(k)] = v })
    const paid: Record<number, boolean> = {}
    Object.entries(data.paid ?? {}).forEach(([k, v]) => { paid[Number(k)] = v })
    set({
      splitId: data.id,
      isSharedSplit: true,
      receipt: data.receipt,
      people: data.people,
      assignments,
      approvals,
      paid,
      history: data.history ?? [],
      _nextItemId: data.receipt.items.length
        ? Math.max(...data.receipt.items.map(i => i.id)) + 1 : 0,
      _nextPersonId: data.people.length
        ? Math.max(...data.people.map(p => p.id)) + 1 : 0,
      screen: 'summary',
      maxStepIdx: 4,
    })
  },

  reset: () => set({
    screen: 'upload',
    maxStepIdx: 0,
    imageBase64: null,
    receipt: emptyReceipt(),
    scannedSubtotal: 0,
    people: [],
    assignments: {},
    approvals: {},
    paid: {},
    history: [],
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

  const liveSubtotal = receipt.items.reduce((s, i) => s + i.total_price, 0)

  receipt.items.forEach(item => {
    const weights = assignments[item.id] ?? {}
    const entries = Object.entries(weights).map(([pid, w]) => [Number(pid), w] as [number, number])
    const totalWeight = entries.reduce((s, [, w]) => s + w, 0)
    if (!totalWeight) return
    entries.forEach(([pid, w]) => {
      const share = (w / totalWeight) * item.total_price
      subtotals[pid] = (subtotals[pid] ?? 0) + share
      itemLines[pid] = [...(itemLines[pid] ?? []), { name: item.name, share }]
    })
  })

  const grandSub = liveSubtotal > 0 ? liveSubtotal : Object.values(subtotals).reduce((a, b) => a + b, 0)
  const extras = receipt.tax + receipt.tip - (receipt.discount ?? 0)

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
