// Fuzzy visit dates. People rarely remember the exact day they saw a river, so a
// visit date is stored as a partial ISO string — "2003", "2019-08", or
// "2019-08-14" — exactly as precise as the person actually knows. We never force
// a full calendar date. Helpers here normalise for sorting and render for humans.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Normalise loose user input to a canonical partial-ISO date, or '' if it isn't
 *  a recognisable year / year-month / full date. Accepts `/` or `.` separators. */
export function normalizeDate(input: string): string {
  const s = input.trim().replace(/[./]/g, '-')
  if (!s) return ''
  let m = /^(\d{4})$/.exec(s)
  if (m) return m[1]!
  m = /^(\d{4})-(\d{1,2})$/.exec(s)
  if (m) {
    const mo = clampMonth(m[2]!)
    return mo ? `${m[1]}-${mo}` : ''
  }
  m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s)
  if (m) {
    const mo = clampMonth(m[2]!)
    const d = clampDay(m[3]!)
    return mo && d ? `${m[1]}-${mo}-${d}` : ''
  }
  return ''
}

function clampMonth(s: string): string | null {
  const n = Number(s)
  if (!Number.isInteger(n) || n < 1 || n > 12) return null
  return String(n).padStart(2, '0')
}
function clampDay(s: string): string | null {
  const n = Number(s)
  if (!Number.isInteger(n) || n < 1 || n > 31) return null
  return String(n).padStart(2, '0')
}

export function isValidDate(input: string): boolean {
  return normalizeDate(input) !== ''
}

/** A comparable key that orders partial dates sensibly (a bare year sorts before
 *  that year's dated visits). Undated visits sort last (empty → '~'). */
export function sortKey(date: string | undefined): string {
  if (!date) return '~'
  const [y, m, d] = date.split('-')
  return `${y}-${m ?? '00'}-${d ?? '00'}`
}

/** Human rendering: "2003", "Aug 2019", "Aug 14, 2019". */
export function formatDate(date: string | undefined): string {
  if (!date) return 'no date'
  const [y, m, d] = date.split('-')
  if (!m) return y!
  const mon = MONTHS[Number(m) - 1] ?? m
  if (!d) return `${mon} ${y}`
  return `${mon} ${Number(d)}, ${y}`
}

/** The 4-digit year, or null if the date is empty/garbage. */
export function yearOf(date: string | undefined): number | null {
  if (!date) return null
  const y = Number(date.slice(0, 4))
  return Number.isInteger(y) ? y : null
}
