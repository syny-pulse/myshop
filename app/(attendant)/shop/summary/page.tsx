import { requireAttendant } from '@/lib/auth';
import { rangeFromParams, formatDateShort } from '@/lib/dates';
import { getAttendantSummary, getSalesForAttendant } from '@/lib/queries';
import { formatUGX, formatNumber, pluralise } from '@/lib/format';
import { RangePicker } from '@/components/RangePicker';
import { StatCard } from '@/components/ui/StatCard';

export const metadata = { title: 'Summary · Shop Books' };

/**
 * ATTENDANT VIEW.
 *
 * getAttendantSummary() and getSalesForAttendant() select no unit cost and no
 * profit expression, so there is no margin figure on this page to hide. Stock
 * appears as a unit count only, with no valuation attached.
 */
export default async function AttendantSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const session = await requireAttendant();

  const range = rangeFromParams(await searchParams);
  const [summary, sales] = await Promise.all([
    getAttendantSummary(range),
    getSalesForAttendant(range),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[1.5rem] font-semibold tracking-tight">Summary</h1>
        <p className="mt-1 text-[0.9375rem] text-[var(--text-muted)]">{range.label}</p>
      </div>

      <RangePicker />

      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Sales"
          value={formatUGX(summary.revenue)}
          sublabel={`${formatNumber(summary.transactions)} ${pluralise(summary.transactions, 'sale')}`}
        />
        <StatCard
          label="Items sold"
          value={formatNumber(summary.unitsSold)}
          sublabel="In this period"
        />
        <StatCard
          label="Items on hand"
          value={formatNumber(summary.stockUnits)}
          sublabel="As of today"
        />
      </section>

      <section>
        <h2 className="mb-3 text-[0.9375rem] font-semibold">Sales recorded</h2>
        {sales.length === 0 ? (
          <p className="surface px-4 py-8 text-center text-[0.875rem] text-[var(--text-muted)]">
            No sales recorded for {range.label.toLowerCase()}.
          </p>
        ) : (
          <ul className="surface divide-y overflow-hidden">
            {sales.map((sale) => (
              <li
                key={sale.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium leading-snug">
                    {sale.quantity > 1 && `${sale.quantity} × `}
                    {sale.specifics}
                  </p>
                  <p className="text-[0.8125rem] text-[var(--text-muted)]">
                    {formatDateShort(sale.saleDate)} · {sale.categoryName} ·{' '}
                    {sale.attendantName ?? 'owner'}
                    {sale.attendantName === session.name && ' (you)'}
                  </p>
                </div>
                <p className="tnum font-medium">
                  {formatUGX(sale.unitPrice * sale.quantity)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
