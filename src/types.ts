export interface Item {
  id: number
  name: string
  quantity: number
  unit_price: number
  total_price: number
}

export interface Receipt {
  items: Item[]
  subtotal: number
  tax: number
  tip: number
  total: number
}

export interface Person {
  id: number
  name: string
  color: string
}

/** itemId → array of assigned personIds */
export type Assignments = Record<number, number[]>

export type Screen = 'upload' | 'items' | 'people' | 'assign' | 'summary' | 'history'

export interface SupabaseSplit {
  id: string
  created_at: string
  expires_at: string
  receipt: Receipt
  people: Person[]
  assignments: Record<string, number[]>
}
