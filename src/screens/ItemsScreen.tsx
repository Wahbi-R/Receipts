import { useSplitStore } from '../store/useSplitStore'

export default function ItemsScreen() {
  const receipt = useSplitStore(s => s.receipt)
  const { updateItemField, removeItem, addItem, updateMeta, setScreen } = useSplitStore()

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Review items</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Edit anything that looks wrong</p>
      </div>

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
                  <input
                    type="number"
                    value={item.total_price.toFixed(2)}
                    min={0}
                    step={0.01}
                    onChange={e => updateItemField(item.id, 'total_price', parseFloat(e.target.value) || 0)}
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
        {(['subtotal', 'tax', 'tip'] as const).map((field, i, arr) => (
          <div
            key={field}
            className={`flex items-center px-4 ${i < arr.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''}`}
          >
            <span className="capitalize text-sm text-gray-500 dark:text-gray-400 w-20">{field}</span>
            <div className="flex items-center flex-1 py-2.5">
              <span className="text-gray-400 mr-1 text-sm">$</span>
              <input
                type="number"
                value={receipt[field].toFixed(2)}
                min={0}
                step={0.01}
                onChange={e => updateMeta(field, parseFloat(e.target.value) || 0)}
                className="flex-1 bg-transparent text-right text-sm outline-none"
              />
            </div>
          </div>
        ))}
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
