import type { ReceiptImage } from '../store/useSplitStore'
import type { Receipt } from '../types'

const API_BASE = 'https://audio.wabble.ca'

export async function scanReceipt(images: ReceiptImage[]): Promise<Receipt> {
  const res = await fetch(`${API_BASE}/receipt/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      images: images.map(img => ({ data: img.base64, media_type: img.mediaType })),
    }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<Receipt>
}
