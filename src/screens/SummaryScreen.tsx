import { useState } from 'react'
import { useSplitStore, calcPersonTotals } from '../store/useSplitStore'
import { saveSplit } from '../lib/supabase'
import type { HistoryEntry } from '../types'

function HistoryTimeline({ entries }: { entries: HistoryEntry[] }) {
  const sorted = [...entries].reverse()
  return (
    <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
      <div className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Change history
      </div>
      <div className="px-4 pb-3">
        {sorted.map((entry, i) => (
          <div key={i} className="flex gap-3 py-2 border-t border-gray-100 dark:border-gray-700 first:border-0">
            <div className="flex flex-col items-center pt-1 shrink-0">
              <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
              {i < sorted.length - 1 && (
                <div className="w-px flex-1 bg-gray-100 dark:bg-gray-700 mt-1" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-700 dark:text-gray-300">{entry.msg}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{timeAgo(entry.ts)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function SummaryScreen() {
  const receipt = useSplitStore(s => s.receipt)
  const people = useSplitStore(s => s.people)
  const assignments = useSplitStore(s => s.assignments)
  const approvals = useSplitStore(s => s.approvals)
  const paid = useSplitStore(s => s.paid)
  const history = useSplitStore(s => s.history)
  const splitId = useSplitStore(s => s.splitId)
  const { reset, setLoading, setApproval, setPaid, addHistory } = useSplitStore()
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const totals = calcPersonTotals(receipt, people, assignments)

  const autoSave = async () => {
    const store = useSplitStore.getState()
    if (!store.splitId) return
    await saveSplit(receipt, people, assignments, store.splitId).catch(console.warn)
  }

  const handleApproval = async (personId: number) => {
    const next = !approvals[personId]
    const name = people.find(p => p.id === personId)?.name ?? 'Someone'
    setApproval(personId, next)
    addHistory(next ? `${name} approved their share` : `${name} removed their approval`)
    await autoSave()
  }

  const handlePaid = async (personId: number) => {
    const next = !paid[personId]
    const name = people.find(p => p.id === personId)?.name ?? 'Someone'
    setPaid(personId, next)
    addHistory(next ? `${name} marked as paid` : `${name} unmarked as paid`)
    await autoSave()
  }

  const handleShare = async () => {
    setLoading(true, 'Saving split…')
    try {
      if (!splitId) addHistory('Split created')
      const id = await saveSplit(receipt, people, assignments, splitId ?? undefined)
      const url = `${window.location.origin}${window.location.pathname}?s=${id}`
      setShareUrl(url)
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err: unknown) {
      alert('Failed to save split.\n\n' + (err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleCopyText = async () => {
    const lines: string[] = [`🧾 ${receipt.title || 'Receipt Split'}\n`]
    totals.forEach(({ person, items, total }) => {
      lines.push(`${person.name}: $${total.toFixed(2)}`)
      items.forEach(i => lines.push(`  • ${i.name}: $${i.share.toFixed(2)}`))
      lines.push('')
    })
    lines.push(`Total: $${receipt.total.toFixed(2)}`)
    await navigator.clipboard.writeText(lines.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{receipt.title || 'Summary'}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Here's who owes what</p>
      </div>

      {totals.map(({ person, items, extraShare, total }) => {
        const isApproved = approvals[person.id]
        const isPaid = paid[person.id]
        return (
          <div key={person.id} className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
            <div
              className="px-4 py-3 flex items-center justify-between"
              style={{ backgroundColor: person.color + '22' }}
            >
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: person.color }} />
                <span className="font-semibold">{person.name}</span>
                {isApproved && (
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-1.5 py-0.5 rounded-full">
                    ✓ Looks good
                  </span>
                )}
                {isPaid && (
                  <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 rounded-full">
                    $ Paid
                  </span>
                )}
              </div>
              <span className="text-lg font-bold">${total.toFixed(2)}</span>
            </div>

            <div className="px-4 py-2 text-sm">
              {items.map((line, i) => (
                <div key={i} className="flex items-baseline justify-between py-0.5">
                  <span className="text-gray-600 dark:text-gray-400">{line.name}</span>
                  <span>${line.share.toFixed(2)}</span>
                </div>
              ))}
              {items.length > 0 && extraShare > 0 && (
                <div className="flex items-baseline justify-between py-0.5 text-gray-400 text-xs border-t border-gray-100 dark:border-gray-700 mt-1 pt-1.5">
                  <span>Tax &amp; tip (proportional)</span>
                  <span>+${extraShare.toFixed(2)}</span>
                </div>
              )}
              {items.length === 0 && (
                <p className="text-gray-400 text-xs py-1">No items assigned</p>
              )}
            </div>

            <div className="px-4 pb-3 flex gap-2">
              <button
                onClick={() => handleApproval(person.id)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold border-2 transition-all active:scale-[.97] ${
                  isApproved
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : 'border-emerald-400 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                }`}
              >
                {isApproved ? '✓ Looks good!' : 'Looks good?'}
              </button>
              <button
                onClick={() => handlePaid(person.id)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold border-2 transition-all active:scale-[.97] ${
                  isPaid
                    ? 'bg-blue-500 border-blue-500 text-white'
                    : 'border-blue-400 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30'
                }`}
              >
                {isPaid ? '$ Paid ✓' : 'Mark paid'}
              </button>
            </div>

            {(isApproved || isPaid) && !splitId && (
              <p className="px-4 pb-2.5 text-[10px] text-gray-400">
                Share the link below for others to see this status
              </p>
            )}
          </div>
        )
      })}

      {/* Grand total */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm px-4 py-3 flex justify-between font-bold">
        <span>Total</span>
        <span>${receipt.total.toFixed(2)}</span>
      </div>

      {/* Share link */}
      {shareUrl && (
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-4 py-2.5 text-sm break-all text-emerald-700 dark:text-emerald-300">
          {shareUrl}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleShare}
          className="flex-1 py-3.5 rounded-xl bg-emerald-500 text-white font-semibold text-base hover:bg-emerald-600 active:scale-[.98] transition-all"
        >
          {copied && shareUrl ? '✓ Copied!' : '🔗 Share Link'}
        </button>
        <button
          onClick={handleCopyText}
          className="flex-1 py-3.5 rounded-xl border border-gray-200 dark:border-gray-700 font-semibold text-sm hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-[.98] transition-all"
        >
          {copied && !shareUrl ? '✓ Copied!' : '📋 Copy Text'}
        </button>
      </div>

      {history.length > 0 && (
        <HistoryTimeline entries={history} />
      )}

      <button
        onClick={reset}
        className="w-full py-2.5 rounded-xl text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
      >
        Start new receipt
      </button>
    </div>
  )
}
