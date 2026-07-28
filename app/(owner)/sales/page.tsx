import { requireOwner } from '@/lib/auth';
import { rangeFromParams, formatDateShort } from '@/lib/dates';
import { getSalesForOwner, getSellableItems } from '@/lib/queries';
import { formatUGX, formatNumber, pluralise } from '@/lib/format';
import { PageHeader } from '@/components/ui/PageHeader';
import { RangePicker } from '@/components/RangePicker';
import { SaleForm } from '@/components/forms/SaleForm';
import { DeleteSale } from './DeleteSale';

export const metadata = { title: 'Sales · Shop Books' };

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  await requireOwner();

  const range = rangeFromParams(await searchParams);
  const [items, sales] = await Promise.all([
    getSellableItems(),
    getSalesForOwner(range),
  ]);

  const revenue = sales.reduce((sum, s) => sum + s.unitPrice * s.quantity, 0);
  const profit = sales.reduce((sum, s) => sum + (s.unitPrice - s.unitCost) * s.quantity, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Sales" description="Record a sale and review what has sold." />

      <div className="surface p-5">
        <h2 className="mb-4 text-[0.9375rem] font-semibold">Record a sale</h2>
        <SaleForm items={items} />
      </div>

      <div className="space-y-3">
        <h2 className="text-[0.9375rem] font-semibold">Sales history</h2>
        <RangePicker />
      </div>

      {sales.length === 0 ? (
        <p className="surface px-4 py-8 text-center text-[0.875rem] text-[var(--text-muted)]">
          No sales recorded for {range.label.toLowerCase()}.
        </p>
      ) : (
        <>
          <div className="surface flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 px-4 py-3.5">
            <div>
              <p className="text-[0.8125rem] text-[var(--text-muted)]">
                {formatNumber(sales.length)} {pluralise(sales.length, 'sale')}
              </p>
              <p className="tnum text-[1.25rem] font-semibold tracking-tight">
                {formatUGX(revenue)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[0.8125rem] text-[var(--text-muted)]">Profit on goods</p>
              <p
                className="tnum text-[1.25rem] font-semibold tracking-tight"
                style={{ color: profit < 0 ? 'var(--negative)' : 'var(--positive)' }}
              >
                {profit < 0 ? '−' : '+'}
                {formatUGX(Math.abs(profit))}
              </p>
            </div>
          </div>

          <ul className="surface divide-y overflow-hidden">
            {sales.map((sale) => {
              const lineProfit = (sale.unitPrice - sale.unitCost) * sale.quantity;
              return (
                <li key={sale.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                    <div className="min-w-0">
                      <p className="font-medium leading-snug">
                        {sale.quantity > 1 && `${sale.quantity} × `}
                        {sale.specifics}
                      </p>
                      <p className="text-[0.8125rem] text-[var(--text-muted)]">
                        {formatDateShort(sale.saleDate)} · {sale.categoryName} ·{' '}
                        {sale.attendantName ?? 'you'}
                      </p>
                      {sale.belowMin && (
                        <span className="chip chip-warn mt-1.5">
                          Below minimum of {formatUGX(sale.minPrice)}
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="tnum font-medium">
                        {formatUGX(sale.unitPrice * sale.quantity)}
                      </p>
                      <p
                        className="tnum text-[0.8125rem]"
                        style={{
                          color: lineProfit < 0 ? 'var(--negative)' : 'var(--positive)',
                        }}
                      >
                        {lineProfit < 0 ? '−' : '+'}
                        {formatUGX(Math.abs(lineProfit))}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2">
                    <DeleteSale id={sale.id} />
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
