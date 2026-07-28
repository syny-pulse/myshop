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
export function dayOfWeek(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** "2026-03-15" -> "2026-03-01". */
export function startOfMonth(isoDate: string): string {
  return `${isoDate.slice(0, 7)}-01`;
}

/**
 * Shift by whole months, clamping to the last day of the target month.
 *
 * The clamp is the whole point: Date.UTC rolls a day overflow forward, so a
 * naive month shift turns 31 March into 3 March (via "31 February") and the
 * calendar's back arrow would skip February altogether.
 */
export function addMonths(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const shifted = new Date(Date.UTC(y, m - 1 + months, 1));
  // Day 0 of the following month is the last day of this one.
  const lastDay = new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 0),
  ).getUTCDate();
  shifted.setUTCDate(Math.min(d, lastDay));
  return shifted.toISOString().slice(0, 10);
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

/** "March 2026" — the calendar heading. */
export function formatMonthYear(isoDate: string): string {
  const [y, m] = isoDate.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}

/** The day number to print in a calendar cell: "2026-03-05" -> 5. */
export function dayOfMonth(isoDate: string): number {
  return Number(isoDate.slice(8, 10));
}

/**
 * Six Monday-first weeks covering the month `isoDate` falls in, padded either
 * side with the neighbouring months' days.
 *
 * Monday-first to agree with rangeFor('week'). Always six rows, never five:
 * a short month rendering one row less would make the popover change height
 * as the month arrows are tapped, and the arrow would slide out from under
 * the finger already on it.
 */
export function calendarWeeks(isoDate: string): string[][] {
  const first = startOfMonth(isoDate);
  const lead = (dayOfWeek(first) + 6) % 7; // Sunday(0) -> 6, Monday(1) -> 0
  const gridStart = addDays(first, -lead);

  return Array.from({ length: 6 }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => addDays(gridStart, week * 7 + day)),
  );
}

/** Column headings for calendarWeeks, Monday first. 1 Jan 2024 was a Monday. */
export const WEEKDAY_LABELS: string[] = Array.from({ length: 7 }, (_, i) =>
  new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2024, 0, 1 + i)),
  ),
);

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
