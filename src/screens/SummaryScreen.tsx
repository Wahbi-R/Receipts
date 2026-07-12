import { useState } from 'react'
import { useSplitStore, calcPersonTotals } from '../store/useSplitStore'
import { saveSplit } from '../lib/supabase'

export default function SummaryScreen() {
  const receipt = useSplitStore(s => s.receipt)
  const people = useSplitStore(s => s.people)
  const assignments = useSplitStore(s => s.assignments)
  const splitId = useSplitStore(s => s.splitId)
  const { reset, setLoading } = useSplitStore()
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const totals = calcPersonTotals(receipt, people, assignments)

  const handleShare = async () => {
    setLoading(true, 'Saving split…')
    try {
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
    const lines: string[] = ['🧾 Receipt Split\n']
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
        <h1 className="text-2xl font-bold tracking-tight">Summary</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Here's who owes what</p>
      </div>

      {totals.map(({ person, items, extraShare, total }) => (
        <div key={person.id} className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
          <div
            className="px-4 py-3 flex items-center justify-between"
            style={{ backgroundColor: person.color + '22' }}
          >
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: person.color }}
              />
              <span className="font-semibold">{person.name}</span>
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
            {items.length > 0 && (extraShare > 0) && (
              <div className="flex items-baseline justify-between py-0.5 text-gray-400 text-xs border-t border-gray-100 dark:border-gray-700 mt-1 pt-1.5">
                <span>Tax &amp; tip (proportional)</span>
                <span>+${extraShare.toFixed(2)}</span>
              </div>
            )}
            {items.length === 0 && (
              <p className="text-gray-400 text-xs py-1">No items assigned</p>
            )}
          </div>
        </div>
      ))}

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

      <button
        onClick={reset}
        className="w-full py-2.5 rounded-xl text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
      >
        Start new receipt
      </button>
    </div>
  )
}
