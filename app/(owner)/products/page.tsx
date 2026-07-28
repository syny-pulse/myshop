import Link from 'next/link';
import { PackageIcon } from '@phosphor-icons/react/dist/ssr';
import { requireOwner } from '@/lib/auth';
import { getItemsWithCost } from '@/lib/queries';
import { formatUGX, formatNumber, pluralise } from '@/lib/format';
import { formatDate } from '@/lib/dates';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ArchiveToggle } from './ArchiveToggle';

export const metadata = { title: 'Stock · Shop Books' };

export default async function ProductsPage() {
  await requireOwner();
  const items = await getItemsWithCost();

  const active = items.filter((i) => !i.archived);
  const archived = items.filter((i) => i.archived);

  return (
    <div>
      <PageHeader
        title="Stock"
        description="Everything you have bought, with what it cost you and what it should sell for."
        action={{ href: '/products/new', label: 'Add stock' }}
      />

      {items.length === 0 ? (
        <EmptyState
          icon={PackageIcon}
          title="No stock recorded yet"
          body="After a shopping trip, add what you bought so sales and profit can be tracked against it."
          action={{ href: '/products/new', label: 'Add stock' }}
        />
      ) : (
        <div className="space-y-6">
          <ProductList items={active} />

          {archived.length > 0 && (
            <details className="surface px-4 py-3">
              <summary className="cursor-pointer text-[0.875rem] font-medium text-[var(--text-muted)]">
                {archived.length} archived {pluralise(archived.length, 'batch', 'batches')}
              </summary>
              <div className="mt-3">
                <ProductList items={archived} />
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function ProductList({ items }: { items: Awaited<ReturnType<typeof getItemsWithCost>> }) {
  if (items.length === 0) {
    return (
      <p className="surface px-4 py-6 text-center text-[0.875rem] text-[var(--text-muted)]">
        Nothing in stock. Everything you have bought has sold or been archived.
      </p>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => {
        const soldOut = item.qtyRemaining === 0;
        const marginPerUnit = item.minPrice - item.costPrice;

        return (
          <li key={item.id} className="surface flex flex-col gap-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="chip chip-muted">{item.categoryName}</span>
                <p className="mt-1.5 font-medium leading-snug">{item.specifics}</p>
                <p className="mt-0.5 text-[0.75rem] text-[var(--text-faint)]">
                  Bought {formatDate(item.purchaseDate)}
                </p>
              </div>
              <span className={soldOut ? 'chip chip-muted' : 'chip chip-accent'}>
                {soldOut
                  ? 'Sold out'
                  : `${formatNumber(item.qtyRemaining)} of ${formatNumber(item.quantity)} left`}
              </span>
            </div>

            <dl className="tnum grid grid-cols-3 gap-2 border-t pt-3 text-[0.8125rem]">
              <div>
                <dt className="text-[var(--text-faint)]">Cost</dt>
                <dd className="mt-0.5 font-medium">{formatUGX(item.costPrice)}</dd>
              </div>
              <div>
                <dt className="text-[var(--text-faint)]">Sells at</dt>
                <dd className="mt-0.5 font-medium">{formatUGX(item.minPrice)}</dd>
              </div>
              <div>
                <dt className="text-[var(--text-faint)]">Margin</dt>
                <dd
                  className="mt-0.5 font-medium"
                  style={{
                    color: marginPerUnit < 0 ? 'var(--negative)' : 'var(--positive)',
                  }}
                >
                  {marginPerUnit < 0 ? '−' : '+'}
                  {formatUGX(Math.abs(marginPerUnit))}
                </dd>
              </div>
            </dl>

            <div className="flex gap-2">
              <Link
                href={`/products/${item.id}`}
                className="btn btn-secondary flex-1 py-1.5 text-[0.875rem]"
              >
                Edit
              </Link>
              <ArchiveToggle id={item.id} archived={item.archived} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
