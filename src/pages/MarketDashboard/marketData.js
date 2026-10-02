/**
 * @typedef {{date: string, value: number}} MarketHistoryPoint
 * @typedef {Object} MarketQuote
 * @property {string} id
 * @property {number | null} value
 * @property {number | null} change
 * @property {number | null} changePercent
 * @property {string | null} asOfDate
 * @property {string | null} asOf
 * @property {string | null} fetchedAt
 * @property {string | null} sourceUrl
 * @property {boolean} stale
 * @property {MarketHistoryPoint[]} history
 * @typedef {{updatedAt: string | null, indicators: MarketQuote[]}} MarketSnapshot
 */

const VALID_IDS = new Set(['dow', 'nasdaq', 'hangseng', 'ftse', 'dax', 'nikkei', 'cac', 'gold', 'silver', 'copper', 'brent', 'sp500', 'vix', 'treasury', 'dollar', 'usdcny'])
const safeNumber = (value) => typeof value === 'number' && Number.isFinite(value) ? value : null
const safeTime = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null

/** @param {unknown} input @returns {MarketSnapshot} */
export function normalizeMarketSnapshot(input) {
  if (!input || typeof input !== 'object' || input.version !== 1 || !Array.isArray(input.indicators)) {
    throw new Error('Invalid market snapshot')
  }
  const unique = new Map()
  const now = Date.now()
  for (const item of input.indicators) {
    if (!item || typeof item !== 'object' || !VALID_IDS.has(item.id)) continue
    const daily = new Map()
    if (Array.isArray(item.history)) {
      for (const point of item.history) {
        if (point && /^\d{4}-\d{2}-\d{2}$/.test(point.date) && Number.isFinite(Date.parse(point.date)) && safeNumber(point.value) > 0) {
          daily.set(point.date, { date: point.date, value: point.value })
        }
      }
    }
    let sourceUrl = null
    try {
      const source = new URL(item.sourceUrl)
      if (source.protocol === 'https:' && source.hostname === 'finance.yahoo.com') sourceUrl = source.href
    } catch { /* Missing source links are optional. */ }
    unique.set(item.id, {
      id: item.id, value: safeNumber(item.value) > 0 ? item.value : null,
      change: safeNumber(item.change), changePercent: safeNumber(item.changePercent),
      asOfDate: typeof item.asOfDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.asOfDate) && Number.isFinite(Date.parse(item.asOfDate)) ? item.asOfDate : null,
      asOf: safeTime(item.asOf), fetchedAt: safeTime(item.fetchedAt), sourceUrl,
      stale: item.stale === true || !safeTime(item.fetchedAt) || now - Date.parse(item.fetchedAt) > 15 * 60 * 1000,
      history: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)),
    })
  }
  if (![...unique.values()].some((item) => item.value !== null)) throw new Error('No market quotes available')
  return { updatedAt: safeTime(input.updatedAt), indicators: [...unique.values()] }
}

/** @param {MarketHistoryPoint[]} history @param {'1m'|'3m'|'12m'|'all'} range */
export function historyForRange(history, range) {
  if (!history.length || range === 'all') return history
  const end = new Date(`${history.at(-1).date}T00:00:00Z`)
  const months = { '1m': 1, '3m': 3, '12m': 12 }[range] || 3
  const month = end.getUTCMonth() - months
  const lastDay = new Date(Date.UTC(end.getUTCFullYear(), month + 1, 0)).getUTCDate()
  const cutoff = new Date(Date.UTC(end.getUTCFullYear(), month, Math.min(end.getUTCDate(), lastDay))).toISOString().slice(0, 10)
  return history.filter((point) => point.date >= cutoff)
}
