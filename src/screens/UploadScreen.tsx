import { useRef, useCallback } from 'react'
import { useSplitStore } from '../store/useSplitStore'
import { scanReceipt } from '../lib/api'

export default function UploadScreen() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageBase64 = useSplitStore(s => s.imageBase64)
  const { setImage, setReceipt, setScreen, setLoading } = useSplitStore()

  const handleManual = () => {
    setReceipt({ items: [], subtotal: 0, discount: 0, tax: 0, tip: 0, total: 0 })
    setScreen('items')
  }

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = e => {
      const dataUrl = e.target!.result as string
      setImage(dataUrl.split(',')[1], file.type)
    }
    reader.readAsDataURL(file)
  }, [setImage])

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleFile(e.target.files[0])
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0])
  }

  const onScan = async () => {
    const { imageBase64: b64, mediaType } = useSplitStore.getState()
    if (!b64) return
    setLoading(true, 'Scanning receipt…')
    try {
      const data = await scanReceipt(b64, mediaType)
      const nextId = { current: 0 }
      const receipt = {
        ...data,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        items: (data.items ?? []).map((item: any) => ({
          id: nextId.current++,
          name:        String(item.name ?? 'Unknown item'),
          quantity:    Number(item.quantity   ?? 1),
          unit_price:  Number(item.unit_price  ?? 0),
          total_price: Number(item.total_price ?? 0),
        })),
      }
      useSplitStore.setState({ _nextItemId: nextId.current })
      setReceipt(receipt)
      setScreen('items')
    } catch (err: unknown) {
      alert('Failed to scan receipt.\n\n' + (err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Scan a receipt</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Take a photo or upload an image</p>
      </div>

      {/* Drop zone */}
      <div
        className="relative rounded-2xl bg-white dark:bg-gray-800 border-2 border-dashed border-gray-200 dark:border-gray-700 min-h-56 flex items-center justify-center overflow-hidden cursor-pointer hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
        onDrop={onDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={onFileChange}
        />

        {imageBase64 ? (
          <img
            src={`data:image/jpeg;base64,${imageBase64}`}
            alt="Receipt preview"
            className="max-h-80 w-full object-contain pointer-events-none"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-gray-400 dark:text-gray-600 pointer-events-none">
            <span className="text-5xl">📷</span>
            <span className="text-sm">Tap to take photo or upload</span>
          </div>
        )}
      </div>

      <button
        onClick={onScan}
        disabled={!imageBase64}
        className="w-full py-3.5 rounded-xl bg-emerald-500 text-white font-semibold text-base disabled:opacity-40 hover:bg-emerald-600 active:scale-[.98] transition-all"
      >
        Scan Receipt →
      </button>

      <button
        onClick={handleManual}
        className="w-full py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 font-semibold text-sm hover:bg-gray-50 dark:hover:bg-gray-800 active:scale-[.98] transition-all"
      >
        Enter manually
      </button>
    </div>
  )
}
