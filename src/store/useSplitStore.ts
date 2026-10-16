import { create } from 'zustand'
import type { Item, Receipt, Person, Assignments, Screen, SupabaseSplit, HistoryEntry, Sign } from '../types'

export const PERSON_COLORS = [
  '#EF4444', '#3B82F6', '#10B981', '#F59E0B',
  '#8B5CF6', '#EC4899', '#06B6D4', '#F97316',
  '#84CC16', '#6366F1', '#14B8A6', '#E11D48',
  '#A855F7', '#0EA5E9', '#D97706', '#64748B',
]

/** Colors repeat after the palette runs out, so there's no cap on people. */
const personColor = (index: number) => PERSON_COLORS[index % PERSON_COLORS.length]

const emptyReceipt = (): Receipt => ({
  items: [], subtotal: 0, discount: 0, tax: 0, tip: 0, total: 0,
})

export const STEP_ORDER: Screen[] = ['upload', 'items', 'people', 'assign', 'summary']

/** Everyone gets the identical portion, so everyone pays exactly the same share. */
function splitEqually(quantity: number, pids: number[]): Record<number, number> {
  const n = pids.length
  if (!n) return {}
  const w: Record<number, number> = {}
  pids.forEach(pid => { w[pid] = quantity / n })
  return w
}

/**
 * Older versions rounded each portion down to 0.01 and gave the leftover to the
 * last person (1 item / 7 people -> six at 0.14, one at 0.16), overcharging them.
 * Detect that exact pattern in saved splits and replace it with an equal split.
 */
function fixLegacyEqualSplit(quantity: number, weights: Record<number, number>): Record<number, number> {
  const pids = Object.keys(weights).map(Number)
  const n = pids.length
  if (n < 2) return weights
  const base = Math.floor((quantity / n) * 100) / 100
  const last = Math.round((quantity - base * (n - 1)) * 100) / 100
  if (base === last) return weights
  const vals = pids.map(p => weights[p])
  const looksLegacy = vals.filter(v => v === base).length === n - 1 && vals.filter(v => v === last).length === 1
  return looksLegacy ? splitEqually(quantity, pids) : weights
}

/** Fields that are saved to Supabase and synced live between viewers. */
const SYNC_FIELDS = ['receipt', 'people', 'assignments', 'approvals', 'paid', 'history'] as const
type SyncField = typeof SYNC_FIELDS[number]
export type SyncSnapshot = Record<SyncField, string>

/** JSON with sorted keys, so local state and Postgres jsonb (which reorders keys) compare equal. */
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort()
      .filter(k => (value as Record<string, unknown>)[k] !== undefined)
      .map(k => `${JSON.stringify(k)}:${stableJson((value as Record<string, unknown>)[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(value ?? null)
}

export function syncSnapshot(src: Pick<SplitStore, SyncField> | SupabaseSplit): SyncSnapshot {
  const out = {} as SyncSnapshot
  SYNC_FIELDS.forEach(f => { out[f] = stableJson((src as Record<SyncField, unknown>)[f] ?? (f === 'history' ? [] : {})) })
  return out
}

function parseSplit(data: SupabaseSplit) {
  const assignments: Assignments = {}
  Object.entries(data.assignments ?? {}).forEach(([k, v]) => {
    const weights: Record<number, number> = {}
    Object.entries(v).forEach(([pid, w]) => { weights[Number(pid)] = w })
    const qty = data.receipt.items.find(i => i.id === Number(k))?.quantity ?? 1
    assignments[Number(k)] = fixLegacyEqualSplit(qty, weights)
  })
  const approvals: Record<number, Sign> = {}
  Object.entries(data.approvals ?? {}).forEach(([k, v]) => { approvals[Number(k)] = v })
  const paid: Record<number, Sign> = {}
  Object.entries(data.paid ?? {}).forEach(([k, v]) => { paid[Number(k)] = v })
  return {
    receipt: data.receipt,
    people: data.people,
    assignments,
    approvals,
    paid,
    history: data.history ?? [],
  }
}

function nextIds(receipt: Receipt, people: Person[]) {
  return {
    _nextItemId: receipt.items.length ? Math.max(...receipt.items.map(i => i.id)) + 1 : 0,
    _nextPersonId: people.length ? Math.max(...people.map(p => p.id)) + 1 : 0,
  }
}

export function isDirty(s: Pick<SplitStore, SyncField | '_synced'>): boolean {
  if (!s._synced) return false
  const now = syncSnapshot(s)
  return SYNC_FIELDS.some(f => now[f] !== s._synced![f])
}

export type SaveState = 'saved' | 'saving' | 'error'

/** What changed in the last live update from someone else, for highlighting rows. */
export interface Flash {
  at: number
  people: number[]
  items: number[]
}

function diffIds<T extends { id: number }>(before: T[], after: T[]): number[] {
  const prev = new Map(before.map(x => [x.id, stableJson(x)]))
  return after.filter(x => prev.get(x.id) !== stableJson(x)).map(x => x.id)
}

function diffKeys(before: Record<number, unknown>, after: Record<number, unknown>): number[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  return [...keys].filter(k => stableJson(before[Number(k)]) !== stableJson(after[Number(k)])).map(Number)
}

export interface ReceiptImage {
  base64: string
  mediaType: string
}

interface SplitStore {
  screen: Screen
  maxStepIdx: number
  loading: boolean
  loadingMsg: string
  images: ReceiptImage[]
  receipt: Receipt
  scannedSubtotal: number
  people: Person[]
  assignments: Assignments
  approvals: Record<number, Sign>
  paid: Record<number, Sign>
  history: HistoryEntry[]
  splitId: string | null
  isSharedSplit: boolean
  /** What this device last saved to / received from Supabase, per field. */
  _synced: SyncSnapshot | null
  saveState: SaveState
  toast: { msg: string; at: number } | null
  flash: Flash | null
  _nextItemId: number
  _nextPersonId: number

  setScreen(screen: Screen): void
  setLoading(loading: boolean, msg?: string): void
  addImage(base64: string, mediaType: string): void
  removeImage(index: number): void
  setReceipt(receipt: Receipt): void
  updateItemField(id: number, field: keyof Pick<Item, 'name' | 'quantity' | 'unit_price' | 'total_price'>, value: string | number): void
  updateItemFields(id: number, fields: Partial<Pick<Item, 'quantity' | 'unit_price' | 'total_price'>>): void
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
  setApproval(personId: number, value: Sign): void
  setPaid(personId: number, value: Sign): void
  addHistory(msg: string): void
  setSplitId(id: string): void
  setImages(images: ReceiptImage[]): void
  loadFromSupabase(data: SupabaseSplit): void
  applyRemoteSplit(data: SupabaseSplit): void
  markSynced(snapshot: SyncSnapshot): void
  setSaveState(state: SaveState): void
  showToast(msg: string): void
  reset(): void
}

export const useSplitStore = create<SplitStore>((set, _get) => ({
  screen: 'upload',
  maxStepIdx: 0,
  loading: false,
  loadingMsg: 'Loading…',
  images: [],
  receipt: emptyReceipt(),
  scannedSubtotal: 0,
  people: [],
  assignments: {},
  approvals: {},
  paid: {},
  history: [],
  splitId: null,
  isSharedSplit: false,
  _synced: null,
  saveState: 'saved',
  toast: null,
  flash: null,
  _nextItemId: 0,
  _nextPersonId: 0,

  setScreen: (screen) => set(s => {
    const idx = STEP_ORDER.indexOf(screen)
    return { screen, maxStepIdx: idx > s.maxStepIdx ? idx : s.maxStepIdx }
  }),

  setLoading: (loading, msg = 'Loading…') => set({ loading, loadingMsg: msg }),

  addImage: (base64, mediaType) => set(s => ({ images: [...s.images, { base64, mediaType }] })),

  removeImage: (index) => set(s => ({ images: s.images.filter((_, i) => i !== index) })),

  setReceipt: (receipt) => {
    const assignments: Assignments = {}
    receipt.items.forEach(item => { assignments[item.id] = {} })
    set({ receipt, scannedSubtotal: receipt.subtotal, assignments, splitId: null, isSharedSplit: false, _synced: null })
  },

  updateItemField: (id, field, value) => set(s => ({
    receipt: {
      ...s.receipt,
      items: s.receipt.items.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    },
  })),

  updateItemFields: (id, fields) => set(s => ({
    receipt: {
      ...s.receipt,
      items: s.receipt.items.map(item =>
        item.id === id ? { ...item, ...fields } : item
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
    const id = s._nextPersonId
    return {
      people: [...s.people, { id, name, color: personColor(s.people.length) }],
      _nextPersonId: id + 1,
    }
  }),

  removePerson: (id) => set(s => {
    const people = s.people
      .filter(p => p.id !== id)
      .map((p, i) => ({ ...p, color: personColor(i) }))
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
    const qty = item?.quantity ?? 1
    const weights = { ...(s.assignments[itemId] ?? {}) }
    const vals = Object.values(weights)
    const wasEqualSplit = vals.every(v => Math.abs(v - vals[0]) < 1e-9)
    const claimed = vals.reduce((a, b) => a + b, 0)
    if (weights[personId] !== undefined) {
      delete weights[personId]
      // Custom portions (e.g. 1 of 2) stay as set; the freed part shows as unclaimed
      if (!wasEqualSplit) return { assignments: { ...s.assignments, [itemId]: weights } }
    } else if (claimed > 0 && qty - claimed > 1e-6) {
      // Someone already claimed part of it: the new person takes what's left
      weights[personId] = qty - claimed
      return { assignments: { ...s.assignments, [itemId]: weights } }
    } else {
      weights[personId] = 1
    }
    const assigned = Object.keys(weights).map(Number)
    if (!assigned.length) return { assignments: { ...s.assignments, [itemId]: {} } }
    return { assignments: { ...s.assignments, [itemId]: splitEqually(qty, assigned) } }
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

  setImages: (images) => set({ images }),

  loadFromSupabase: (data) => {
    const fields = parseSplit(data)
    set({
      splitId: data.id,
      isSharedSplit: true,
      ...fields,
      ...nextIds(fields.receipt, fields.people),
      _synced: syncSnapshot(data),
      screen: 'summary',
      maxStepIdx: 4,
    })
  },

  // Live update from another viewer. A field this device has edited but not
  // saved yet keeps the local version (it'll go out with the next save);
  // every other field takes the incoming version.
  applyRemoteSplit: (data) => set(s => {
    if (data.id !== s.splitId) return s
    const remote = syncSnapshot(data)
    const local = syncSnapshot(s)
    const fields = parseSplit(data)
    const next: Partial<SplitStore> = {}
    SYNC_FIELDS.forEach(f => {
      if (remote[f] === local[f]) return
      const editedLocally = s._synced !== null && local[f] !== s._synced[f]
      if (!editedLocally) (next as Record<SyncField, unknown>)[f] = fields[f]
    })
    const receipt = next.receipt ?? s.receipt
    const people = next.people ?? s.people
    const ids = nextIds(receipt, people)

    const applied = Object.keys(next).length > 0
    const flash: Flash | null = applied ? {
      at: Date.now(),
      people: [...new Set([
        ...(next.people ? diffIds(s.people, next.people) : []),
        ...(next.approvals ? diffKeys(s.approvals, next.approvals) : []),
        ...(next.paid ? diffKeys(s.paid, next.paid) : []),
      ])],
      items: [...new Set([
        ...(next.receipt ? diffIds(s.receipt.items, next.receipt.items) : []),
        ...(next.assignments ? diffKeys(s.assignments, next.assignments) : []),
      ])],
    } : s.flash
    let toast = s.toast
    if (applied) {
      const seen = new Set(s.history.map(h => h.ts + h.msg))
      const fresh = (next.history ?? []).filter(h => !seen.has(h.ts + h.msg))
      const msg = fresh.length
        ? fresh[fresh.length - 1].msg + (fresh.length > 1 ? ` (+${fresh.length - 1} more)` : '')
        : 'Someone updated the split'
      toast = { msg, at: Date.now() }
    }

    return {
      ...next,
      flash,
      toast,
      _synced: remote,
      _nextItemId: Math.max(s._nextItemId, ids._nextItemId),
      _nextPersonId: Math.max(s._nextPersonId, ids._nextPersonId),
    }
  }),

  markSynced: (snapshot) => set({ _synced: snapshot }),

  setSaveState: (saveState) => set({ saveState }),

  showToast: (msg) => set({ toast: { msg, at: Date.now() } }),

  reset: () => set({
    screen: 'upload',
    maxStepIdx: 0,
    images: [],
    receipt: emptyReceipt(),
    scannedSubtotal: 0,
    people: [],
    assignments: {},
    approvals: {},
    paid: {},
    history: [],
    splitId: null,
    isSharedSplit: false,
    _synced: null,
    saveState: 'saved',
    toast: null,
    flash: null,
    _nextItemId: 0,
    _nextPersonId: 0,
  }),
}))

/**
 * Portions are units of the item: 1 of 2 means paying half, and the other half
 * stays unclaimed. If more than the quantity is claimed, it's shared proportionally.
 */
export function portionDivisor(item: Item, claimed: number): number {
  return Math.max(claimed, item.quantity > 0 ? item.quantity : claimed)
}

export interface UnaccountedItem {
  item: Item
  claimed: number     // units claimed so far
  amount: number      // pre-tax dollars nobody is paying for
}

/** Items (or parts of items) nobody has claimed yet. */
export function unaccountedItems(receipt: Receipt, assignments: Assignments): UnaccountedItem[] {
  return receipt.items.flatMap(item => {
    const claimed = Object.values(assignments[item.id] ?? {}).reduce((s, w) => s + w, 0)
    const amount = claimed > 0 ? item.total_price * (1 - claimed / portionDivisor(item, claimed)) : item.total_price
    return amount > 0.005 ? [{ item, claimed, amount }] : []
  })
}

/** Per-person split calculation — used by Assign + Summary screens */
/** Dollars rounded to the cent, so float noise never counts as a change. */
export const toCents = (n: number) => Math.round(n * 100)

/**
 * How a "Looks good" / "Paid" mark compares with what the person owes now.
 * - none:  not marked
 * - ok:    marked for exactly the current amount (or a legacy mark with no amount)
 * - more:  their share went up since they marked it
 * - less:  their share went down since they marked it
 */
export type SignStatus = 'none' | 'ok' | 'more' | 'less'

export function signStatus(mark: Sign | undefined, total: number): SignStatus {
  if (mark === undefined || mark === false) return 'none'
  if (mark === true) return 'ok'
  const diff = toCents(total) - toCents(mark)
  return diff === 0 ? 'ok' : diff > 0 ? 'more' : 'less'
}

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
    const divisor = portionDivisor(item, totalWeight)
    entries.forEach(([pid, w]) => {
      const share = (w / divisor) * item.total_price
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
