import { createClient } from '@supabase/supabase-js'
import { useSplitStore } from '../store/useSplitStore'
import type { Receipt, Person, Assignments, SupabaseSplit } from '../types'

export const SUPABASE_URL = 'https://syocailabsljnapwvaox.supabase.co'
export const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5b2NhaWxhYnNsam5hcHd2YW94Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4NzQ1MzcsImV4cCI6MjA5OTQ1MDUzN30.7AdIdZDPexgCJKMl0ma76kRFZFy0UkQDmlIPFYNDyU8'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const TABLE = 'receipt_splits'

export interface HistoryEntry {
  id: string
  created_at: string
  title?: string
  total: number
  people: string[]
}

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem('receipt_history') ?? '[]')
    const cutoff = Date.now() - 5 * 24 * 60 * 60 * 1000
    return (raw as HistoryEntry[]).filter(e => new Date(e.created_at).getTime() > cutoff)
  } catch {
    return []
  }
}

export async function checkUrlForSplit() {
  const id = new URLSearchParams(window.location.search).get('s')
  if (!id) return

  const { setLoading, loadFromSupabase } = useSplitStore.getState()
  setLoading(true, 'Loading split…')

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('id', id)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (error || !data) {
      alert("This split link has expired or doesn't exist.")
      history.replaceState({}, '', window.location.pathname)
    } else {
      loadFromSupabase(data as SupabaseSplit)
    }
  } catch (e: unknown) {
    alert('Failed to load split: ' + (e as Error).message)
  } finally {
    setLoading(false)
  }
}

const WABWAY_URL = 'https://audio.wabble.ca'

export async function saveSplit(
  receipt?: Receipt,
  people?: Person[],
  assignments?: Assignments,
  splitId?: string,
): Promise<string> {
  const store = useSplitStore.getState()
  const r = receipt ?? store.receipt
  const p = people ?? store.people
  const a = assignments ?? store.assignments
  const id = splitId ?? store.splitId

  const rawAssignments: Record<string, Record<string, number>> = {}
  Object.entries(a).forEach(([k, v]) => { rawAssignments[k] = v as Record<string, number> })

  const { approvals: rawApprovals, paid: rawPaid, history } = store
  const approvalsOut: Record<string, boolean> = {}
  Object.entries(rawApprovals).forEach(([k, v]) => { approvalsOut[k] = v })
  const paidOut: Record<string, boolean> = {}
  Object.entries(rawPaid).forEach(([k, v]) => { paidOut[k] = v })

  const res = await fetch(`${WABWAY_URL}/receipt/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      receipt: r, people: p, assignments: rawAssignments,
      approvals: approvalsOut, paid: paidOut, history, split_id: id,
    }),
  })

  if (!res.ok) {
    const detail = await res.json().then(d => d.detail).catch(() => res.statusText)
    throw new Error(detail)
  }

  const row = await res.json() as { id: string; created_at: string }
  if (!id) {
    store.setSplitId(row.id)
    saveToLocalHistory(row, r.total, p.map(pp => pp.name), r.title)
  }
  return row.id
}

function saveToLocalHistory(
  row: { id: string; created_at: string },
  total: number,
  names: string[],
  title?: string,
) {
  try {
    const hist = JSON.parse(localStorage.getItem('receipt_history') ?? '[]') as HistoryEntry[]
    hist.unshift({ id: row.id, created_at: row.created_at, total, people: names, title })
    localStorage.setItem('receipt_history', JSON.stringify(hist.slice(0, 30)))
  } catch { /* ignore */ }
}
