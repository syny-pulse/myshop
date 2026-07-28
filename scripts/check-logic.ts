/**
 * Regression checks for the date and money helpers. No database needed.
 *
 *   npm run test:logic
 *
 * These cover the three places this app is most likely to go quietly wrong:
 *   1. Kampala is UTC+3, so a naive UTC "today" files early-morning sales
 *      under the previous day.
 *   2. Date ranges must include both endpoints, or the last day of a period
 *      vanishes from the dashboard.
 *   3. Postgres returns SUM() over integers as a STRING, so unguarded
 *      arithmetic concatenates instead of adding.
 */
import {
  WEEKDAY_LABELS,
  addDays,
  addMonths,
  calendarWeeks,
  dayOfMonth,
  dayOfWeek,
  eachDay,
  isValidIsoDate,
  rangeFor,
  startOfMonth,
  todayInKampala,
  formatDate,
  formatMonthYear,
  rangeFromParams,
} from '../lib/dates';
import {
  formatUGX,
  formatSignedUGX,
  toNumber,
  formatCompactUGX,
  marginPercent,
} from '../lib/format';
import { positiveMoney } from '../lib/validation';

let failed = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) console.log(`        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

console.log('\n--- The Kampala timezone trap (plan verification pass 8) ---');
// 22:30 UTC on 28 Jul is already 01:30 on 29 Jul in Kampala (UTC+3).
const lateUtc = new Date('2026-07-28T22:30:00Z');
const naive = lateUtc.toISOString().slice(0, 10);
const kampala = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala' }).format(lateUtc);
check('naive UTC slice returns the WRONG (previous) day', naive, '2026-07-28');
check('Africa/Kampala returns the correct day', kampala, '2026-07-29');
console.log(`        -> a sale at 01:30 Kampala would have been filed under ${naive} without the helper`);

console.log('\n--- addDays across awkward boundaries ---');
check('month boundary', addDays('2026-01-31', 1), '2026-02-01');
check('year boundary', addDays('2026-12-31', 1), '2027-01-01');
check('backwards over year boundary', addDays('2027-01-01', -1), '2026-12-31');
check('leap day exists in 2028', addDays('2028-02-28', 1), '2028-02-29');
check('no leap day in 2026', addDays('2026-02-28', 1), '2026-03-01');

console.log('\n--- eachDay is inclusive of both endpoints (plan verification pass 9) ---');
check('single day', eachDay('2026-07-28', '2026-07-28'), ['2026-07-28']);
check('three days inclusive', eachDay('2026-07-28', '2026-07-30'), [
  '2026-07-28',
  '2026-07-29',
  '2026-07-30',
]);
check('full January is 31 days', eachDay('2026-01-01', '2026-01-31').length, 31);

console.log('\n--- isValidIsoDate rejects impossible dates ---');
check('valid date', isValidIsoDate('2026-07-29'), true);
check('30 February rejected', isValidIsoDate('2026-02-30'), false);
check('month 13 rejected', isValidIsoDate('2026-13-01'), false);
check('29 Feb in a non-leap year rejected', isValidIsoDate('2026-02-29'), false);
check('29 Feb in a leap year accepted', isValidIsoDate('2028-02-29'), true);
check('junk rejected', isValidIsoDate('not-a-date'), false);

console.log('\n--- rangeFor invariants ---');
const today = todayInKampala();
const todayRange = rangeFor('today');
check('today range is a single day', [todayRange.from, todayRange.to], [today, today]);

const week = rangeFor('week');
check('week ends today', week.to, today);
check('week start is on or before today', week.from <= week.to, true);
const weekStartDow = new Date(`${week.from}T00:00:00Z`).getUTCDay();
check('week starts on a Monday', weekStartDow, 1);
check('week is at most 7 days', eachDay(week.from, week.to).length <= 7, true);

const month = rangeFor('month');
check('month starts on the 1st', month.from.slice(-2), '01');
check('month ends today', month.to, today);

const backwards = rangeFor('custom', '2026-07-30', '2026-07-01');
check('a backwards custom range is corrected, not dropped', [backwards.from, backwards.to], [
  '2026-07-01',
  '2026-07-30',
]);

console.log('\n--- rangeFromParams tolerates bad URL input ---');
check('unknown preset falls back to today', rangeFromParams({ range: 'nonsense' }).from, today);
check('invalid custom date falls back safely', rangeFromParams({ range: 'custom', from: '2026-02-30', to: '2026-03-05' }).to, '2026-03-05');

console.log('\n--- addMonths clamps instead of overflowing (the DatePicker arrows) ---');
// Without the clamp, Date.UTC rolls "31 February" forward and the back arrow
// jumps from March to March, skipping February entirely.
check('31 Mar back a month lands on 28 Feb, not 3 Mar', addMonths('2026-03-31', -1), '2026-02-28');
check('31 Jan forward a month in a leap year', addMonths('2028-01-31', 1), '2028-02-29');
check('31 Aug forward a month clamps to 30 Sep', addMonths('2026-08-31', 1), '2026-09-30');
check('short day is untouched', addMonths('2026-03-15', -1), '2026-02-15');
check('forward over the year boundary', addMonths('2026-12-15', 1), '2027-01-15');
check('backwards over the year boundary', addMonths('2026-01-15', -1), '2025-12-15');
check('twelve months is a year', addMonths('2026-07-29', 12), '2027-07-29');

console.log('\n--- calendarWeeks: the month grid ---');
check('startOfMonth', startOfMonth('2026-03-15'), '2026-03-01');

const marchGrid = calendarWeeks('2026-03-15');
const marchCells = marchGrid.flat();
check('always six rows, so the popover never changes height', marchGrid.length, 6);
check('seven columns', marchGrid[0].length, 7);
check('42 cells in total', marchCells.length, 42);
check('the grid starts on a Monday', dayOfWeek(marchCells[0]), 1);
check('the grid ends on a Sunday', dayOfWeek(marchCells[41]), 0);
check('cells run consecutively', addDays(marchCells[0], 41), marchCells[41]);
check('the 1st of the month is present', marchCells.includes('2026-03-01'), true);
check('the last day of the month is present', marchCells.includes('2026-03-31'), true);
check('every day of the month is present', eachDay('2026-03-01', '2026-03-31').every((d) => marchCells.includes(d)), true);

// 1 Feb 2026 is a Sunday, so a Monday-first grid needs six leading days.
check('a month starting on Sunday still shows the 1st', calendarWeeks('2026-02-01').flat().includes('2026-02-01'), true);
check('leap day appears in its own grid', calendarWeeks('2028-02-10').flat().includes('2028-02-29'), true);
// A 31-day month starting on a Sunday is the worst case: 6 lead days + 31 = 37.
check('the worst-case month still fits in 42 cells', eachDay('2026-11-01', '2026-11-30').every((d) => calendarWeeks('2026-11-01').flat().includes(d)), true);

console.log('\n--- Calendar labels ---');
check('month heading', formatMonthYear('2026-03-15'), 'March 2026');
check('heading ignores the day', formatMonthYear('2026-03-01'), formatMonthYear('2026-03-31'));
check('day number for a cell', dayOfMonth('2026-03-05'), 5);
check('weekday headings start on Monday', WEEKDAY_LABELS[0], 'Mon');
check('weekday headings end on Sunday', WEEKDAY_LABELS[6], 'Sun');
check('seven weekday headings', WEEKDAY_LABELS.length, 7);

console.log('\n--- Money formatting (UGX, whole shillings) ---');
check('formats with USh prefix', formatUGX(45000).startsWith('USh'), true);
check('no decimal places', formatUGX(45000).includes('.'), false);
check('zero', formatUGX(0).startsWith('USh'), true);
check('positive profit carries a plus', formatSignedUGX(12000).startsWith('+'), true);
check('negative profit carries a real minus sign', formatSignedUGX(-3400).startsWith('−'), true);
check('compact millions', formatCompactUGX(1_250_000), 'USh 1.3M');
check('compact keeps exact below a million', formatCompactUGX(999_000).includes('999'), true);

console.log('\n--- toNumber: the Postgres bigint-as-string trap ---');
check('SUM() returned as a string becomes a number', toNumber('1234'), 1234);
check('adding two aggregates does not concatenate', toNumber('12') + toNumber('34'), 46);
check('null aggregate becomes 0', toNumber(null), 0);
check('undefined becomes 0', toNumber(undefined), 0);
check('junk becomes 0 rather than NaN', toNumber('abc'), 0);

console.log('\n--- Margin guards divide-by-zero ---');
check('zero revenue returns null instead of Infinity', marginPercent(0, 500), null);
check('normal margin', marginPercent(1000, 250), '25.0%');

console.log('\n--- Date display is unambiguous ---');
check('formatDate avoids DD/MM ambiguity', formatDate('2026-03-05'), '5 Mar 2026');

console.log('\n--- Amounts survive the thousands separators shown while typing ---');
const parseMoney = (raw: unknown) => {
  const result = positiveMoney.safeParse(raw);
  return result.success ? result.data : 'REJECTED';
};
check('bare digits, the normal path', parseMoney('15000'), 15000);
check('grouped input is not read as NaN', parseMoney('15,000'), 15000);
check('grouped millions', parseMoney('1,250,000'), 1250000);
check('stray spaces from a paste', parseMoney(' 45 000 '), 45000);
check('decimals still round to whole shillings', parseMoney('1,500.6'), 1501);
check('zero is still rejected', parseMoney('0'), 'REJECTED');
check('empty is still rejected', parseMoney(''), 'REJECTED');
check('junk is still rejected', parseMoney('abc'), 'REJECTED');
check('the ceiling still holds', parseMoney('2,000,000,001'), 'REJECTED');

console.log(`\n${failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`}\n`);
process.exit(failed === 0 ? 0 : 1);
