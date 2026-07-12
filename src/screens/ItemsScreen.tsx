import { useState, useRef } from 'react'
import { useSplitStore } from '../store/useSplitStore'
import type { Receipt } from '../types'

function NumericInput({
  value, onChange, className, min = 0, placeholder,
}: {
  value: number
  onChange: (v: number) => void
  className?: string
  min?: number
  placeholder?: string
}) {
  const [raw, setRaw] = useState<string | null>(null)
  return (
    <input
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      value={raw !== null ? raw : value.toFixed(2)}
      onFocus={e => { setRaw(value === 0 ? '' : value.toFixed(2)); e.target.select() }}
      onChange={e => setRaw(e.target.value)}
      onBlur={() => {
        const n = parseFloat(raw ?? '')
        onChange(isNaN(n) ? min : Math.max(min, n))
        setRaw(null)
      }}
      className={className}
    />
  )
}

export default function ItemsScreen() {
  const receipt = useSplitStore(s => s.receipt)
  const scannedSubtotal = useSplitStore(s => s.scannedSubtotal)
  const imageBase64 = useSplitStore(s => s.imageBase64)
  const mediaType = useSplitStore(s => s.mediaType)
  const { updateItemField, removeItem, addItem, updateMeta, setScreen, setReceipt, setTitle } = useSplitStore()

  const [showImage, setShowImage] = useState(false)
  const [lightbox, setLightbox] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)

  const handleExport = () => {
    const escape = (s: string) => s.includes(',') ? `"${s.replace(/"/g, '""')}"` : s
    const rows = [
      'name,quantity,unit_price,total_price',
      ...receipt.items.map(i =>
        `${escape(i.name)},${i.quantity},${i.unit_price.toFixed(2)},${i.total_price.toFixed(2)}`
      ),
      '',
      `discount,${(receipt.discount ?? 0).toFixed(2)}`,
      `tax,${receipt.tax.toFixed(2)}`,
      `tip,${receipt.tip.toFixed(2)}`,
    ]
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'receipt.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const lines = (ev.target!.result as string).split(/\r?\n/)
        const items: Receipt['items'] = []
        const meta: Record<string, number> = {}
        let idCounter = 0

        for (const raw of lines) {
          const line = raw.trim()
          if (!line) continue

          // Parse CSV respecting quoted fields
          const cols = line.match(/("(?:[^"]|"")*"|[^,]*)/g)
            ?.map(c => c.replace(/^"|"$/g, '').replace(/""/g, '"').trim()) ?? []

          if (cols.length >= 4) {
            // Item row: name, qty, unit_price, total_price
            const name = cols[0]
            if (!name || name.toLowerCase() === 'name') continue // header
            items.push({
              id: idCounter++,
              name,
              quantity:    parseFloat(cols[1]) || 1,
              unit_price:  parseFloat(cols[2]) || 0,
              total_price: parseFloat(cols[3]) || 0,
            })
          } else if (cols.length === 2) {
            // Metadata row: key, value
            const key = cols[0].toLowerCase()
            const val = parseFloat(cols[1]) || 0
            if (['discount', 'tax', 'tip', 'subtotal', 'total'].includes(key)) meta[key] = val
          }
        }

        if (!items.length) throw new Error('No items found — expected columns: name, quantity, unit_price, total_price')

        setReceipt({
          items,
          subtotal: meta.subtotal ?? 0,
          discount: meta.discount ?? 0,
          tax:      meta.tax      ?? 0,
          tip:      meta.tip      ?? 0,
          total:    meta.total    ?? 0,
        })
      } catch (err: unknown) {
        alert('Import failed: ' + (err as Error).message)
      }
      e.target.value = ''
    }
    reader.readAsText(file)
  }

  const liveSubtotal = receipt.items.reduce((sum, i) => sum + i.total_price, 0)
  const liveTotal = liveSubtotal - (receipt.discount ?? 0) + receipt.tax + receipt.tip

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Review items</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Edit anything that looks wrong</p>
        </div>
        <div className="flex gap-1.5 shrink-0 mt-1">
          {imageBase64 && (
            <button
              onClick={() => setShowImage(v => !v)}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 font-semibold transition-colors"
            >
              {showImage ? '🙈' : '📷'}
            </button>
          )}
          <button
            onClick={handleExport}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 font-semibold transition-colors"
            title="Export CSV"
          >
            ↓ CSV
          </button>
          <button
            onClick={() => importRef.current?.click()}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 font-semibold transition-colors"
            title="Import CSV"
          >
            ↑ CSV
          </button>
          <input ref={importRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={handleImport} />
        </div>
      </div>

      {/* Receipt image toggle */}
      {showImage && imageBase64 && (
        <div className="rounded-2xl overflow-hidden bg-white dark:bg-gray-800 shadow-sm">
          <img
            src={`data:${mediaType};base64,${imageBase64}`}
            alt="Receipt"
            className="w-full object-contain max-h-96 cursor-zoom-in"
            onClick={() => setLightbox(true)}
          />
        </div>
      )}

      {/* Lightbox */}
      {lightbox && imageBase64 && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(false)}
        >
          <img
            src={`data:${mediaType};base64,${imageBase64}`}
            alt="Receipt"
            className="max-w-full max-h-full object-contain rounded-lg"
          />
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white text-2xl leading-none"
            onClick={() => setLightbox(false)}
          >
            ✕
          </button>
        </div>
      )}

      {/* Title */}
      <input
        type="text"
        value={receipt.title ?? ''}
        onChange={e => setTitle(e.target.value)}
        placeholder="Receipt title (optional)"
        maxLength={60}
        className="w-full rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 transition-colors"
      />

      {/* Empty scan notice */}
      {receipt.items.length === 0 && (
        <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          Nothing was detected — add items manually below.
        </div>
      )}

      {/* Items table */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-700">
              <th className="text-left px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-400">Item</th>
              <th className="text-right px-2 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-400 w-12">Qty</th>
              <th className="text-right px-2 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-400 w-20">Price</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {receipt.items.map(item => (
              <tr key={item.id} className="border-b border-gray-100 dark:border-gray-700 last:border-0">
                <td className="px-2 py-1">
                  <input
                    type="text"
                    value={item.name}
                    onChange={e => updateItemField(item.id, 'name', e.target.value)}
                    className="w-full bg-transparent rounded-md px-1.5 py-1 border border-transparent focus:border-emerald-500 focus:bg-emerald-50 dark:focus:bg-emerald-950/40 outline-none transition-colors"
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="number"
                    value={item.quantity}
                    min={0.5}
                    step={0.5}
                    onChange={e => updateItemField(item.id, 'quantity', parseFloat(e.target.value) || 1)}
                    className="w-full bg-transparent rounded-md px-1 py-1 text-right border border-transparent focus:border-emerald-500 focus:bg-emerald-50 dark:focus:bg-emerald-950/40 outline-none transition-colors"
                  />
                </td>
                <td className="px-1 py-1">
                  <NumericInput
                    value={item.total_price}
                    onChange={v => updateItemField(item.id, 'total_price', v)}
                    className="w-full bg-transparent rounded-md px-1 py-1 text-right border border-transparent focus:border-emerald-500 focus:bg-emerald-50 dark:focus:bg-emerald-950/40 outline-none transition-colors"
                  />
                </td>
                <td className="px-1 py-1 text-center">
                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-gray-300 dark:text-gray-600 hover:text-red-500 transition-colors text-sm px-1"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={addItem}
        className="w-full py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-emerald-500 font-semibold text-sm hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
      >
        + Add item
      </button>

      {/* Totals */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
        {/* Subtotal — auto-calculated */}
        <div className="flex items-center px-4 py-2.5 border-b border-gray-100 dark:border-gray-700">
          <span className="text-sm text-gray-500 dark:text-gray-400 w-20">Subtotal</span>
          <span className="flex-1 text-right font-medium text-sm">${liveSubtotal.toFixed(2)}</span>
          {Math.abs(liveSubtotal - scannedSubtotal) > 0.01 && scannedSubtotal > 0 && (
            <span className="ml-2 text-xs text-gray-400 shrink-0">scanned ${scannedSubtotal.toFixed(2)}</span>
          )}
        </div>

        {/* Discount — editable */}
        <div className="flex items-center px-4 border-b border-gray-100 dark:border-gray-700">
          <span className="text-sm text-emerald-600 dark:text-emerald-400 w-20">Discount</span>
          <div className="flex items-center flex-1 py-2.5 justify-end">
            <span className="text-gray-400 mr-1 text-sm">−$</span>
            <NumericInput
              value={receipt.discount ?? 0}
              onChange={v => updateMeta('discount', v)}
              className="bg-transparent text-right text-sm outline-none w-20 text-emerald-600 dark:text-emerald-400"
            />
          </div>
        </div>

        {/* Tax — editable */}
        <div className="flex items-center px-4 border-b border-gray-100 dark:border-gray-700">
          <span className="text-sm text-gray-500 dark:text-gray-400 w-20">Tax</span>
          <div className="flex items-center flex-1 py-2.5 justify-end">
            <span className="text-gray-400 mr-1 text-sm">$</span>
            <NumericInput
              value={receipt.tax}
              onChange={v => updateMeta('tax', v)}
              className="bg-transparent text-right text-sm outline-none w-20"
            />
          </div>
        </div>

        {/* Tip — editable */}
        <div className="flex items-center px-4 border-b border-gray-100 dark:border-gray-700">
          <span className="text-sm text-gray-500 dark:text-gray-400 w-20">Tip</span>
          <div className="flex items-center flex-1 py-2.5 justify-end">
            <span className="text-gray-400 mr-1 text-sm">$</span>
            <NumericInput
              value={receipt.tip}
              onChange={v => updateMeta('tip', v)}
              className="bg-transparent text-right text-sm outline-none w-20"
            />
          </div>
        </div>

        {/* Total — auto-calculated */}
        <div className="flex items-center px-4 py-3">
          <span className="text-sm font-bold w-20">Total</span>
          <span className="flex-1 text-right font-bold">${liveTotal.toFixed(2)}</span>
          {Math.abs(liveTotal - receipt.total) > 0.01 && receipt.total > 0 && (
            <span className="ml-2 text-xs text-gray-400 shrink-0">scanned ${receipt.total.toFixed(2)}</span>
          )}
        </div>
      </div>

      <button
        onClick={() => setScreen('people')}
        className="w-full py-3.5 rounded-xl bg-emerald-500 text-white font-semibold text-base hover:bg-emerald-600 active:scale-[.98] transition-all"
      >
        Add People →
      </button>
    </div>
  )
}
