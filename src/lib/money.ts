import { useSplitStore } from '../store/useSplitStore'

/**
 * The receipt's currency. Splits shared from WabWay carry it on the receipt
 * (`receipt.currency`, ISO code); everything else — and links made before it
 * was added — is dollars.
 */
export function receiptCurrency(code?: string): string {
  return code && /^[A-Za-z]{3}$/.test(code) ? code.toUpperCase() : 'USD'
}

const formatters = new Map<string, Intl.NumberFormat>()

function formatter(currency: string): Intl.NumberFormat {
  let f = formatters.get(currency)
  if (!f) {
    try {
      f = new Intl.NumberFormat(undefined, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' })
    } catch {
      f = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' })
    }
    formatters.set(currency, f)
  }
  return f
}

/** "¥8,570", "$12.50", "€3.20" — with the currency's own decimals. */
export function formatMoney(amount: number, currency?: string): string {
  return formatter(receiptCurrency(currency)).format(amount)
}

/** Decimals the currency uses (0 for JPY/KRW, 2 for most). */
export function currencyDecimals(currency?: string): number {
  return formatter(receiptCurrency(currency)).resolvedOptions().maximumFractionDigits ?? 2
}

/** Just the symbol: "¥", "$", "€". */
export function currencySymbol(currency?: string): string {
  return formatter(receiptCurrency(currency)).formatToParts(0)
    .find(p => p.type === 'currency')?.value ?? '$'
}

/** Formatter for the split being viewed. */
export function useMoney(): (amount: number) => string {
  const currency = useSplitStore(s => s.receipt.currency)
  return (amount: number) => formatMoney(amount, currency)
}
