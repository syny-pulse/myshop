import Link from 'next/link';
import { WarningIcon } from '@phosphor-icons/react/dist/ssr';
import { requireOwner } from '@/lib/auth';
import { rangeFromParams, formatDateShort } from '@/lib/dates';
import { formatUGX, formatNumber, marginPercent, pluralise } from '@/lib/format';
import {
  getDashboardMetrics,
  getDailySeries,
  getCategoryBreakdown,
  getBelowMinSales,
} from '@/lib/queries';
import { RangePicker } from '@/components/RangePicker';
import { DailySalesChart } from '@/components/DailySalesChart';
import { StatCard, ProfitCard } from '@/components/ui/StatCard';

export const metadata = { title: 'Dashboard · Shop Books' };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  await requireOwner();

  const range = rangeFromParams(await searchParams);

  const [metrics, series, categories, belowMin] = await Promise.all([
    getDashboardMetrics(range),
    getDailySeries(range),
    getCategoryBreakdown(range),
    getBelowMinSales(range),
  ]);

  const margin = marginPercent(metrics.revenue, metrics.grossProfit);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[1.5rem] font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-[0.9375rem] text-[var(--text-muted)]">{range.label}</p>
      </div>

      <RangePicker />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Sales"
          value={formatUGX(metrics.revenue)}
          sublabel={`${formatNumber(metrics.transactions)} ${pluralise(metrics.transactions, 'sale')}, ${formatNumber(metrics.unitsSold)} ${pluralise(metrics.unitsSold, 'item')}`}
        />
        <ProfitCard
          label="Profit on goods"
          amount={metrics.grossProfit}
          sublabel={margin ? `${margin} margin` : 'Before expenses'}
        />
        <StatCard
          label="Expenses"
          value={formatUGX(metrics.expensesTotal)}
          sublabel={`${formatNumber(metrics.expenseCount)} recorded`}
        />
        <ProfitCard
          label={metrics.netProfit < 0 ? 'Net loss' : 'Net profit'}
          amount={metrics.netProfit}
          sublabel="Profit on goods less expenses"
          emphasis
        />
      </section>

      <DailySalesChart points={series} from={range.from} to={range.to} />

      {/*
        Stock is a point-in-time figure: it answers "what am I holding now",
        so it deliberately ignores the range picker above. Said plainly here so
        the number is never misread as belonging to the selected period.
      */}
      <section>
        <h2 className="mb-3 text-[0.9375rem] font-semibold">
          Stock on hand{' '}
          <span className="font-normal text-[var(--text-faint)]">(as of today)</span>
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard
            label="Value at cost"
            value={formatUGX(metrics.stock.atCost)}
            sublabel="What you paid for it"
          />
          <StatCard
            label="Value at selling price"
            value={formatUGX(metrics.stock.atRetail)}
            sublabel="If it all sells at the minimum"
          />
          <StatCard
            label="Items left"
            value={formatNumber(metrics.stock.units)}
            sublabel={`Across ${formatNumber(metrics.stock.batches)} ${pluralise(metrics.stock.batches, 'batch', 'batches')}`}
          />
        </div>
      </section>

      {belowMin.length > 0 && (
        <section
          className="rounded-[var(--radius-card)] border p-4"
          style={{ background: 'var(--warn-soft)', borderColor: 'var(--warn-border)' }}
        >
          <h2
            className="flex items-center gap-2 text-[0.9375rem] font-semibold"
            style={{ color: 'var(--warn)' }}
          >
            <WarningIcon size={17} weight="fill" />
            {belowMin.length} {pluralise(belowMin.length, 'sale')} below the minimum
          </h2>
          <ul className="mt-3 space-y-2">
            {belowMin.map((sale) => (
              <li
                key={sale.id}
                className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-[0.875rem]"
                style={{ color: 'var(--warn)' }}
              >
                <span className="min-w-0">
                  {sale.specifics}
                  <span className="text-[0.8125rem] opacity-80">
                    {' '}
                    · {formatDateShort(sale.saleDate)}
                    {sale.attendantName ? ` · ${sale.attendantName}` : ' · you'}
                  </span>
                </span>
                <span className="tnum whitespace-nowrap font-medium">
                  {formatUGX(sale.unitPrice)} of {formatUGX(sale.minPrice)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-[0.9375rem] font-semibold">By category</h2>
        {categories.length === 0 ? (
          <div className="surface px-4 py-8 text-center text-[0.875rem] text-[var(--text-muted)]">
            No sales in this period.{' '}
            <Link href="/sales" className="font-medium underline">
              Record one
            </Link>
            .
          </div>
        ) : (
          <div className="surface divide-y overflow-hidden">
            {categories.map((c) => (
              <div
                key={c.categoryId}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium">{c.categoryName}</p>
                  <p className="tnum text-[0.8125rem] text-[var(--text-muted)]">
                    {formatNumber(c.unitsSold)} {pluralise(c.unitsSold, 'item')} sold
                  </p>
                </div>
                <div className="text-right">
                  <p className="tnum font-medium">{formatUGX(c.revenue)}</p>
                  <p
                    className="tnum text-[0.8125rem]"
                    style={{
                      color: c.profit < 0 ? 'var(--negative)' : 'var(--positive)',
                    }}
                  >
                    {c.profit < 0 ? '−' : '+'}
                    {formatUGX(Math.abs(c.profit))} profit
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
