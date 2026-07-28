/**
 * All date logic funnels through here.
 *
 * The server runs in UTC; Kampala is UTC+3 with no DST. So the naive
 * `new Date().toISOString().slice(0, 10)` returns YESTERDAY for the first
 * three hours of every Kampala day — a sale recorded at 01:00 would land on
 * the wrong date and fall outside "Today" on the dashboard. Never compute a
 * date from the raw server clock; use these helpers.
 */

export const SHOP_TIMEZONE = 'Africa/Kampala';

/** Today in Kampala as YYYY-MM-DD. 'en-CA' formats as ISO, which is why it's used here. */
export function todayInKampala(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: SHOP_TIMEZONE }).format(new Date());
}

/** Shift a YYYY-MM-DD string by whole days without ever touching local time. */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Day of week for a YYYY-MM-DD string, 0 = Sunday. Computed in UTC to stay stable. */
function dayOfWeek(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export type RangePreset = 'today' | 'week' | 'month' | 'custom';

export interface DateRange {
  from: string;
  to: string;
  label: string;
}

/**
 * Ranges are INCLUSIVE of both endpoints — queries use `>= from AND <= to`
 * against `date` columns, so a sale on the last day is always counted.
 * Weeks start Monday, which is how a Ugandan retail week is usually counted.
 */
export function rangeFor(preset: RangePreset, from?: string, to?: string): DateRange {
  const today = todayInKampala();

  switch (preset) {
    case 'today':
      return { from: today, to: today, label: 'Today' };

    case 'week': {
      const dow = dayOfWeek(today);
      const daysSinceMonday = (dow + 6) % 7; // Sunday(0) -> 6, Monday(1) -> 0
      const start = addDays(today, -daysSinceMonday);
      return { from: start, to: today, label: 'This week' };
    }

    case 'month': {
      const start = `${today.slice(0, 7)}-01`;
      return { from: start, to: today, label: 'This month' };
    }

    case 'custom': {
      const f = from || today;
      const t = to || today;
      // Tolerate a backwards range rather than returning nothing.
      const [lo, hi] = f <= t ? [f, t] : [t, f];
      return { from: lo, to: hi, label: `${formatDate(lo)} to ${formatDate(hi)}` };
    }
  }
}

/** Reads a range off the URL, falling back to Today for anything unrecognised. */
export function rangeFromParams(params: {
  range?: string;
  from?: string;
  to?: string;
}): DateRange {
  const preset: RangePreset =
    params.range === 'week' ||
    params.range === 'month' ||
    params.range === 'custom' ||
    params.range === 'today'
      ? params.range
      : 'today';

  const from = params.from && isValidIsoDate(params.from) ? params.from : undefined;
  const to = params.to && isValidIsoDate(params.to) ? params.to : undefined;

  if (preset !== 'custom') return rangeFor(preset);

  /*
   * If only one endpoint survives validation, fall back to the OTHER endpoint
   * rather than to today. Falling back to today would silently stretch
   * "1 to 5 March" into a five-month range and report figures for a period
   * nobody asked for. Both bad: today, a single day.
   */
  return rangeFor('custom', from ?? to, to ?? from);
}

/** "15 Mar 2026" — unambiguous, and avoids the DD/MM vs MM/DD trap. */
export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** "Mon 15 Mar" — compact, for dense table rows. */
export function formatDateShort(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** Inclusive list of every date in a range — used to pad chart gaps with zeroes. */
export function eachDay(from: string, to: string, cap = 366): string[] {
  const out: string[] = [];
  let cursor = from;
  while (cursor <= to && out.length < cap) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return out;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
  );
}
