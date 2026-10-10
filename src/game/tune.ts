/**
 * The phone numbers only a real phone can set (PLAN.md, Owner Follow-Ups). In dev builds,
 * `?tune=MOTION_REF:5` overrides any of them, so the spike recorder's Play With These runs
 * on its suggestions.
 */
export const PHONE_NUMBERS = [
  'MOTION_REF',
  'TOUCH_GRACE_MS',
  'TOUCH_GRACE_SCALE',
  'STEP_START_JOLT',
  'STEP_END_JOLT',
  'REAL_STRIDE_M',
  'REAL_HAND_SCALE',
  'GENTLE_STEP_JOLT',
  'STOMP_SCALE'
] as const

export type PhoneNumber = (typeof PHONE_NUMBERS)[number]
export type PhoneNumbers = Record<PhoneNumber, number>

/**
 * Reads `tune=NAME:value,NAME:value` from a query string. Unknown names, negative and
 * non-numeric values are ignored.
 */
export function parseTune(search: string): Partial<PhoneNumbers> {
  const out: Partial<PhoneNumbers> = {}
  const raw = new URLSearchParams(search).get('tune')
  if (!raw) return out
  for (const pair of raw.split(',')) {
    const [name, value] = pair.split(':')
    const n = Number(value)
    if (!isPhoneNumber(name) || value === '' || !Number.isFinite(n) || n < 0)
      continue
    out[name] = n
  }
  return out
}

/** The `tune` value for a set of numbers, ready for a URL. */
export function tuneValue(numbers: Partial<PhoneNumbers>): string {
  return PHONE_NUMBERS.filter(name => numbers[name] !== undefined)
    .map(name => `${name}:${numbers[name]}`)
    .join(',')
}

function isPhoneNumber(name: string | undefined): name is PhoneNumber {
  return (PHONE_NUMBERS as readonly string[]).includes(name ?? '')
}

/** Dev only: the overrides in this page's URL, or none. */
export const TUNED: Partial<PhoneNumbers> =
  import.meta.env.DEV && typeof location !== 'undefined'
    ? parseTune(location.search)
    : {}
