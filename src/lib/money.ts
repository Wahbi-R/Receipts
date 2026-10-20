import { create } from 'zustand'
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

// Whether this viewer would rather see amounts in the home currency (CAD)
// than the receipt's (JPY). Per device, like the rest of their settings.
const PREF_KEY = 'prefer_home_currency'
const usePreferHome = create<{ preferHome: boolean; toggle: () => void }>(set => ({
  preferHome: (() => { try { return localStorage.getItem(PREF_KEY) === '1' } catch { return false } })(),
  toggle: () => set(s => {
    const preferHome = !s.preferHome
    try { localStorage.setItem(PREF_KEY, preferHome ? '1' : '0') } catch { /* private mode */ }
    return { preferHome }
  }),
}))

/** The split's two currencies, if WabWay sent a home currency and rate. */
export function useCurrencies() {
  const receipt = useSplitStore(s => s.receipt)
  const { preferHome, toggle } = usePreferHome()
  const local = receiptCurrency(receipt.currency)
  const home = receipt.home_currency && receipt.home_rate && receipt.home_rate > 0
    && receiptCurrency(receipt.home_currency) !== local
    ? { currency: receiptCurrency(receipt.home_currency), rate: receipt.home_rate }
    : null
  return { local, home, showHome: !!home && preferHome, toggle }
}

/**
 * Formatter for the split being viewed, in the viewer's preferred currency
 * ([useCurrencies] — the receipt's own unless they chose the home one).
 * Pass `{ local: true }` where the receipt's own numbers are being edited.
 */
export function useMoney(opts?: { local?: boolean }): (amount: number) => string {
  const { local, home, showHome } = useCurrencies()
  if (home && showHome && !opts?.local) return (amount: number) => formatMoney(amount * home.rate, home.currency)
  return (amount: number) => formatMoney(amount, local)
}

/** "≈ C$76.18" (or "≈ ¥8,570" when home is shown) — the other currency, or null. */
export function useAltMoney(): (amount: number) => string | null {
  const { local, home, showHome } = useCurrencies()
  if (!home) return () => null
  return (amount: number) => '≈ ' + (showHome ? formatMoney(amount, local) : formatMoney(amount * home.rate, home.currency))
}
