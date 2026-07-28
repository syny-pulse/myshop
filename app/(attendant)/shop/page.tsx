import Link from 'next/link';
import { StorefrontIcon } from '@phosphor-icons/react/dist/ssr';
import { requireAttendant } from '@/lib/auth';
import { getSellableItems, getStockUnitCount } from '@/lib/queries';
import { formatUGX, formatNumber, pluralise } from '@/lib/format';

export const metadata = { title: 'Stock · Shop Books' };

/**
 * ATTENDANT VIEW.
 *
 * Built on getSellableItems() and getStockUnitCount(), neither of which selects
 * cost price or any profit expression. That is what keeps margins off this page:
 * the data never reaches the browser, so it cannot be read out of the RSC
 * payload, devtools, or an error overlay.
 */
export default async function ShopStockPage() {
  await requireAttendant();

  const [items, stock] = await Promise.all([getSellableItems(), getStockUnitCount()]);

  const byCategory = new Map<string, typeof items>();
  for (const item of items) {
    const list = byCategory.get(item.categoryName) ?? [];
    list.push(item);
    byCategory.set(item.categoryName, list);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[1.5rem] font-semibold tracking-tight">What is in stock</h1>
        <p className="mt-1 text-[0.9375rem] text-[var(--text-muted)]">
          The price shown is the lowest you should sell for.
        </p>
      </div>

      <div className="surface flex items-baseline justify-between gap-4 px-4 py-3.5">
        <span className="text-[0.8125rem] font-medium text-[var(--text-muted)]">
          Items on hand
        </span>
        <span className="tnum text-[1.35rem] font-semibold tracking-tight">
          {formatNumber(stock.units)}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="surface flex flex-col items-center gap-3 px-6 py-12 text-center">
          <div
            className="flex size-11 items-center justify-center rounded-full"
            style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}
          >
            <StorefrontIcon size={20} weight="duotone" />
          </div>
          <p className="font-medium">Nothing in stock right now</p>
          <p className="max-w-[38ch] text-[0.875rem] text-[var(--text-muted)]">
            The owner has not added any stock, or everything has sold.
          </p>
        </div>
      ) : (
        <>
          {[...byCategory.entries()].map(([category, list]) => (
            <section key={category}>
              <h2 className="mb-2 text-[0.9375rem] font-semibold">{category}</h2>
              <ul className="surface divide-y overflow-hidden">
                {list.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium leading-snug">{item.specifics}</p>
                      <p className="text-[0.8125rem] text-[var(--text-muted)]">
                        {formatNumber(item.qtyRemaining)}{' '}
                        {pluralise(item.qtyRemaining, 'left', 'left')}
                      </p>
                    </div>
                    <span className="chip chip-accent">
                      From {formatUGX(item.minPrice)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <Link href="/shop/sale" className="btn btn-primary w-full">
            Record a sale
          </Link>
        </>
      )}
    </div>
  );
}
