import type { ReceiptImage } from '../store/useSplitStore'

const MAX_EDGE = 2560   // Claude's vision limit; more pixels just add upload time
const JPEG_QUALITY = 0.85

function readAsBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/**
 * Phone photos are often 4-10 MB; scale to MAX_EDGE and re-encode as JPEG so
 * scanning and saving the photos is fast and reliable on mobile data.
 * Falls back to the original file if the browser can't decode it.
 */
export async function shrinkImage(file: File): Promise<ReceiptImage> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', JPEG_QUALITY))
    if (blob && blob.size < file.size) return { base64: await readAsBase64(blob), mediaType: 'image/jpeg' }
  } catch (err) {
    console.warn('Could not shrink image, using original:', err)
  }
  return { base64: await readAsBase64(file), mediaType: file.type }
}
