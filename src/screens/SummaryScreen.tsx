import { useState, useEffect, useRef } from 'react'
import { useSplitStore, calcPersonTotals, unaccountedItems } from '../store/useSplitStore'
import type { UnaccountedItem } from '../store/useSplitStore'
import { saveSplit, uploadImages, addImageToSplit } from '../lib/supabase'
import { shrinkImage } from '../lib/images'
import type { HistoryEntry } from '../types'
import { useFlash, FLASH_CLASS } from '../hooks/useFlash'
import { useMoney, useAltMoney, useCurrencies, formatMoney } from '../lib/money'

function UnaccountedWarning({ list, extrasRate, onFix }: { list: UnaccountedItem[]; extrasRate: number; onFix: () => void }) {
  const money = useMoney()
  const alt = useAltMoney()
  const total = list.reduce((s, u) => s + u.amount, 0) * (1 + extrasRate)
  const fmt = (n: number) => Number(n.toFixed(2))
  return (
    <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/30 overflow-hidden">
      <div className="px-4 pt-3 pb-1 flex items-baseline justify-between">
        <span className="text-sm font-bold text-amber-700 dark:text-amber-300">
          ⚠ Items unaccounted for
        </span>
        <span className="text-sm font-bold text-amber-700 dark:text-amber-300 text-right">
          {money(total)}
          {alt(total) && <span className="block text-[11px] font-medium opacity-70">{alt(total)}</span>}
        </span>
      </div>
      <p className="px-4 text-xs text-amber-700/80 dark:text-amber-300/80">
        Nobody is paying for these yet{extrasRate ? ' (amount includes their tax & tip)' : ''}.
      </p>
      <div className="px-4 py-2">
        {list.map(({ item, claimed, amount }) => (
          <div key={item.id} className="flex items-baseline justify-between py-1 text-sm border-t border-amber-200/70 dark:border-amber-800/50 first:border-0">
            <span className="text-gray-800 dark:text-gray-200 min-w-0 truncate">
              {item.name}
              <span className="ml-1.5 text-xs text-amber-700 dark:text-amber-400">
                {claimed > 0 ? `${fmt(item.quantity - claimed)} of ${item.quantity} unclaimed` : 'nobody assigned'}
              </span>
            </span>
            <span className="ml-2 shrink-0 text-gray-600 dark:text-gray-300">{money(amount)}</span>
          </div>
        ))}
      </div>
      <button
        onClick={onFix}
        className="w-full py-2.5 text-sm font-semibold text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors"
      >
        Assign them →
      </button>
    </div>
  )
}

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
  const money = useMoney()
  const alt = useAltMoney()
  const currencies = useCurrencies()
  const receipt = useSplitStore(s => s.receipt)
  const people = useSplitStore(s => s.people)
  const assignments = useSplitStore(s => s.assignments)
  const approvals = useSplitStore(s => s.approvals)
  const paid = useSplitStore(s => s.paid)
  const history = useSplitStore(s => s.history)
  const splitId = useSplitStore(s => s.splitId)
  const images = useSplitStore(s => s.images)
  const { reset, setLoading, setApproval, setPaid, addHistory, setScreen } = useSplitStore()
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [lightbox, setLightbox] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [addingPhoto, setAddingPhoto] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const handleAddPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter(f => f.type.startsWith('image/'))
    e.target.value = ''
    if (!files.length) return
    const id = useSplitStore.getState().splitId
    if (!id) {
      // Not shared yet: photos upload with everything else on the first Share Link
      for (const f of files) {
        const img = await shrinkImage(f)
        useSplitStore.getState().addImage(img.base64, img.mediaType)
      }
      return
    }
    setAddingPhoto(true)
    let failed = 0
    for (const f of files) {
      const updated = await addImageToSplit(id, await shrinkImage(f))
      if (updated) useSplitStore.getState().setImages(updated)
      else failed++
    }
    setAddingPhoto(false)
    if (failed < files.length) addHistory(`Added ${files.length - failed} receipt photo${files.length - failed > 1 ? 's' : ''}`)
    if (failed) alert(`${failed} photo${failed > 1 ? 's' : ''} didn't upload. Check your connection and try again.`)
  }

  useEffect(() => {
    if (!lightbox) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(false)
      if (e.key === 'ArrowLeft') setLightboxIndex(i => Math.max(0, i - 1))
      if (e.key === 'ArrowRight') setLightboxIndex(i => Math.min(images.length - 1, i + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox, images.length])

  const totals = calcPersonTotals(receipt, people, assignments)
  const flashedPeople = useFlash('people')
  const unaccounted = unaccountedItems(receipt, assignments)
  const itemsSubtotal = receipt.items.reduce((s, i) => s + i.total_price, 0)
  const extrasRate = itemsSubtotal > 0 ? (receipt.tax + receipt.tip - (receipt.discount ?? 0)) / itemsSubtotal : 0

  const handleApproval = (personId: number) => {
    const next = !approvals[personId]
    const name = people.find(p => p.id === personId)?.name ?? 'Someone'
    setApproval(personId, next)
    addHistory(next ? `${name} approved their share` : `${name} removed their approval`)
  }

  const handlePaid = (personId: number) => {
    const next = !paid[personId]
    const name = people.find(p => p.id === personId)?.name ?? 'Someone'
    setPaid(personId, next)
    addHistory(next ? `${name} marked as paid` : `${name} unmarked as paid`)
  }

  const handleShare = async () => {
    setLoading(true, 'Saving split…')
    try {
      const isNew = !splitId
      if (isNew) addHistory('Split created')
      const id = await saveSplit(receipt, people, assignments, splitId ?? undefined)
      if (isNew && images.length) {
        setLoading(true, 'Uploading receipt images…')
        const failed = await uploadImages(id, images)
        if (failed) {
          alert(`${failed} of ${images.length} receipt photo${images.length > 1 ? 's' : ''} didn't upload. The split is saved, but those photos won't show for others.`)
        }
      }
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
      lines.push(`${person.name}: ${money(total)}${alt(total) ? ` (${alt(total)})` : ''}`)
      items.forEach(i => lines.push(`  • ${i.name}: ${money(i.share)}`))
      lines.push('')
    })
    lines.push(`Total: ${money(receipt.total)}${alt(receipt.total) ? ` (${alt(receipt.total)})` : ''}`)
    await navigator.clipboard.writeText(lines.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{receipt.title || 'Summary'}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Here's who owes what</p>
        {currencies.home && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              onClick={currencies.toggle}
              className="rounded-full border border-emerald-400 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 active:scale-[.97] transition-all"
            >
              Show in {currencies.showHome ? currencies.local : currencies.home.currency}
            </button>
            <span className="text-xs text-gray-400">
              {formatMoney(1000, currencies.local)} ≈ {formatMoney(1000 * currencies.home.rate, currencies.home.currency)} at the rate paid
            </span>
          </div>
        )}
      </div>

      {unaccounted.length > 0 && (
        <UnaccountedWarning list={unaccounted} extrasRate={extrasRate} onFix={() => setScreen('assign')} />
      )}

      {/* Receipt image strip */}
      {(images.length > 0 || splitId) && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => { setLightboxIndex(i); setLightbox(true) }}
              className="shrink-0 w-24 h-24 rounded-xl overflow-hidden border-2 border-transparent hover:border-emerald-400 active:scale-95 transition-all focus:outline-none focus:border-emerald-400"
            >
              <img
                src={`data:${img.mediaType};base64,${img.base64}`}
                alt={`Receipt ${i + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
          <button
            onClick={() => photoInputRef.current?.click()}
            disabled={addingPhoto}
            className="shrink-0 w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-400 hover:border-emerald-400 hover:text-emerald-500 flex flex-col items-center justify-center text-xs font-semibold transition-colors disabled:opacity-60"
          >
            {addingPhoto ? 'Uploading…' : <><span className="text-2xl leading-none">+</span>Add photo</>}
          </button>
          <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleAddPhoto} />
        </div>
      )}

      {/* Lightbox */}
      {lightbox && images.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(false)}
        >
          <img
            src={`data:${images[lightboxIndex].mediaType};base64,${images[lightboxIndex].base64}`}
            alt="Receipt"
            className="max-w-full max-h-full object-contain rounded-lg"
          />
          {images.length > 1 && (
            <>
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-4xl leading-none disabled:opacity-20"
                onClick={e => { e.stopPropagation(); setLightboxIndex(i => Math.max(0, i - 1)) }}
                disabled={lightboxIndex === 0}
              >
                ‹
              </button>
              <button
                className="absolute right-12 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-4xl leading-none disabled:opacity-20"
                onClick={e => { e.stopPropagation(); setLightboxIndex(i => Math.min(images.length - 1, i + 1)) }}
                disabled={lightboxIndex === images.length - 1}
              >
                ›
              </button>
              <span className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/50 text-sm">
                {lightboxIndex + 1} / {images.length}
              </span>
            </>
          )}
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white text-2xl leading-none"
            onClick={() => setLightbox(false)}
          >
            ✕
          </button>
        </div>
      )}

      {totals.map(({ person, items, extraShare, total }) => {
        const isApproved = approvals[person.id]
        const isPaid = paid[person.id]
        return (
          <div key={person.id} className={`rounded-2xl bg-white dark:bg-gray-800 shadow-sm overflow-hidden ${flashedPeople.has(person.id) ? FLASH_CLASS : ''}`}>
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
                    ✓ Paid
                  </span>
                )}
              </div>
              <span className="text-lg font-bold text-right leading-tight">
                {money(total)}
                {alt(total) && <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">{alt(total)}</span>}
              </span>
            </div>

            <div className="px-4 py-2 text-sm">
              {items.map((line, i) => (
                <div key={i} className="flex items-baseline justify-between py-0.5">
                  <span className="text-gray-600 dark:text-gray-400">{line.name}</span>
                  <span>{money(line.share)}</span>
                </div>
              ))}
              {items.length > 0 && extraShare > 0 && (
                <div className="flex items-baseline justify-between py-0.5 text-gray-400 text-xs border-t border-gray-100 dark:border-gray-700 mt-1 pt-1.5">
                  <span>Tax &amp; tip (proportional)</span>
                  <span>+{money(extraShare)}</span>
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
                {isPaid ? 'Paid ✓' : 'Mark paid'}
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
        <span className="text-right leading-tight">
          {money(totals.reduce((s, t) => s + t.total, 0))}
          {alt(totals.reduce((s, t) => s + t.total, 0)) && (
            <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">
              {alt(totals.reduce((s, t) => s + t.total, 0))}
            </span>
          )}
        </span>
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
