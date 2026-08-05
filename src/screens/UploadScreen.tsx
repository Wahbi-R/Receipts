import { useRef, useCallback } from 'react'
import { useSplitStore } from '../store/useSplitStore'
import { scanReceipt } from '../lib/api'

const MAX_IMAGES = 5

export default function UploadScreen() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const images = useSplitStore(s => s.images)
  const { addImage, removeImage, setReceipt, setScreen, setLoading } = useSplitStore()

  const handleManual = () => {
    setReceipt({ items: [], subtotal: 0, discount: 0, tax: 0, tip: 0, total: 0 })
    setScreen('items')
  }

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = e => {
      const dataUrl = e.target!.result as string
      addImage(dataUrl.split(',')[1], file.type)
    }
    reader.readAsDataURL(file)
  }, [addImage])

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files ?? []).forEach(handleFile)
    e.target.value = ''
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    Array.from(e.dataTransfer.files).forEach(f => handleFile(f))
  }

  const onScan = async () => {
    const { images: imgs } = useSplitStore.getState()
    if (!imgs.length) return

    setLoading(true, imgs.length > 1 ? `Scanning ${imgs.length} images…` : 'Scanning receipt…')
    try {
      const data = await scanReceipt(imgs)

      const nextId = { current: 0 }
      const receipt = {
        title:    data.title,
        subtotal: data.subtotal ?? 0,
        discount: data.discount ?? 0,
        tax:      data.tax ?? 0,
        tip:      data.tip ?? 0,
        total:    data.total ?? 0,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        items: (data.items ?? []).map((item: any) => ({
          id:          nextId.current++,
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

      {images.length === 0 ? (
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
            multiple
            className="sr-only"
            onChange={onFileChange}
          />
          <div className="flex flex-col items-center gap-2 text-gray-400 dark:text-gray-600 pointer-events-none">
            <span className="text-5xl">📷</span>
            <span className="text-sm">Tap to take photo or upload</span>
          </div>
        </div>
      ) : (
        <div
          className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3"
          onDrop={onDrop}
          onDragOver={e => e.preventDefault()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={onFileChange}
          />
          <div className="grid grid-cols-3 gap-2">
            {images.map((img, i) => (
              <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700">
                <img
                  src={`data:${img.mediaType};base64,${img.base64}`}
                  alt={`Receipt ${i + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => removeImage(i)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-xs flex items-center justify-center hover:bg-red-500 transition-colors leading-none"
                >
                  ✕
                </button>
                <span className="absolute bottom-1 left-1.5 text-xs bg-black/50 text-white rounded px-1 leading-4">
                  {i + 1}
                </span>
              </div>
            ))}
            {images.length < MAX_IMAGES && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-emerald-500 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
              >
                <span className="text-2xl leading-none">+</span>
                <span className="text-xs">Add more</span>
              </button>
            )}
          </div>
        </div>
      )}

      <button
        onClick={onScan}
        disabled={!images.length}
        className="w-full py-3.5 rounded-xl bg-emerald-500 text-white font-semibold text-base disabled:opacity-40 hover:bg-emerald-600 active:scale-[.98] transition-all"
      >
        {images.length > 1 ? `Scan ${images.length} Images →` : 'Scan Receipt →'}
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
