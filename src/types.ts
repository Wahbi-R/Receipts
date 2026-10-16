export interface Item {
  id: number
  name: string
  quantity: number
  unit_price: number
  total_price: number
}

export interface Receipt {
  title?: string
  items: Item[]
  subtotal: number
  discount: number
  tax: number
  tip: number
  total: number
}

export interface Person {
  id: number
  name: string
  color: string
}

/** itemId → { personId: weight }  weight=portions (e.g. 2 means twice as much) */
export type Assignments = Record<number, Record<number, number>>

export type Screen = 'upload' | 'items' | 'people' | 'assign' | 'summary' | 'history'

/**
 * A person's "Looks good" / "Paid" mark. A number is the share (in dollars) they
 * signed off on or paid, so it can be checked against what they owe now.
 * `true` comes from splits saved before amounts were recorded (amount unknown).
 */
export type Sign = number | boolean

export interface HistoryEntry {
  ts: string
  msg: string
}

export interface SupabaseSplit {
  id: string
  created_at: string
  expires_at: string
  receipt: Receipt
  people: Person[]
  assignments: Record<string, Record<string, number>>
  approvals?: Record<string, Sign>
  paid?: Record<string, Sign>
  history?: HistoryEntry[]
}
