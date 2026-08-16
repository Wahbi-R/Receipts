/**
 * Cloudflare Worker — OG link preview for receipts.wabble.ca
 *
 * Deploy steps:
 *  1. Cloudflare dashboard → Workers & Pages → Create Worker
 *  2. Paste this script, click Deploy
 *  3. Go to the worker → Settings → Triggers → Add Route:
 *       receipts.wabble.ca/*   (zone: wabble.ca)
 */

const SUPABASE_URL = 'https://syocailabsljnapwvaox.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5b2NhaWxhYnNsam5hcHd2YW94Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4NzQ1MzcsImV4cCI6MjA5OTQ1MDUzN30.7AdIdZDPexgCJKMl0ma76kRFZFy0UkQDmlIPFYNDyU8'
const BUCKET = 'receipt-images'

const BOT_UA = /bot|crawler|spider|preview|slack|discord|telegram|whatsapp|facebookexternalhit|twitterbot|linkedinbot|applebot|iMessage|curl|wget|python/i

export default {
  async fetch(request) {
    const url = new URL(request.url)
    const splitId = url.searchParams.get('s')
    const ua = request.headers.get('User-Agent') || ''

    if (!splitId || !BOT_UA.test(ua)) {
      return fetch(request)
    }

    try {
      const headers = {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      }

      const [splitRes, filesRes] = await Promise.all([
        fetch(
          `${SUPABASE_URL}/rest/v1/receipt_splits?id=eq.${splitId}&select=receipt,people&limit=1`,
          { headers }
        ),
        fetch(`${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ prefix: `${splitId}/`, limit: 1 }),
        }),
      ])

      const splits = await splitRes.json()
      if (!splits.length) return fetch(request)

      const { receipt, people } = splits[0]
      const title = receipt.title || 'Receipt Split'
      const names = people.map(p => p.name).join(', ')
      const total = `$${Number(receipt.total).toFixed(2)}`
      const description = people.length
        ? `${total} split between ${names}`
        : `Total: ${total}`

      const files = await filesRes.json()
      const imageUrl = Array.isArray(files) && files.length
        ? `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${splitId}/${files[0].name}`
        : null

      const canonical = url.toString()

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${esc(title)}</title>
  <meta property="og:type" content="website">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${esc(canonical)}">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
${imageUrl ? `  <meta property="og:image" content="${esc(imageUrl)}">
  <meta property="og:image:width" content="1200">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="${esc(imageUrl)}">` : '  <meta name="twitter:card" content="summary">'}
  <meta http-equiv="refresh" content="0;url=${esc(canonical)}">
</head>
<body>
  <script>window.location.replace(${JSON.stringify(canonical)})</script>
</body>
</html>`

      return new Response(html, {
        headers: { 'Content-Type': 'text/html;charset=utf-8' },
      })
    } catch {
      return fetch(request)
    }
  },
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
