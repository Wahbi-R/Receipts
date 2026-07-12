import type { Receipt } from '../types'

const API_BASE = 'https://audio.wabble.ca'

export async function scanReceipt(imageBase64: string, mediaType: string): Promise<Receipt> {
  const res = await fetch(`${API_BASE}/receipt/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: imageBase64, media_type: mediaType }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<Receipt>
}
