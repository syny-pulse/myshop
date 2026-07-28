import { requireOwner } from '@/lib/auth';
import { getCategoriesWithCounts } from '@/lib/queries';
import { createCategory } from '@/app/actions/categories';
import { formatNumber, pluralise, toNumber } from '@/lib/format';
import { PageHeader } from '@/components/ui/PageHeader';
import { InlineForm } from '@/components/forms/InlineForm';
import { CategoryRow } from './CategoryRow';

export const metadata = { title: 'Categories · Shop Books' };

export default async function CategoriesPage() {
  await requireOwner();
  const categories = await getCategoriesWithCounts();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Categories"
        description="The groups you sort your stock into, such as carpets, curtains, bedsheets or blankets."
      />

      <div className="surface mb-5 p-5">
        <InlineForm
          action={createCategory}
          label="New category"
          name="name"
          placeholder="Blankets"
          submitLabel="Add category"
        />
      </div>

      {categories.length === 0 ? (
        <p className="surface px-4 py-8 text-center text-[0.875rem] text-[var(--text-muted)]">
          No categories yet. Add your first one above.
        </p>
      ) : (
        <ul className="surface divide-y overflow-hidden">
          {categories.map((c) => {
            const itemCount = toNumber(c.itemCount);
            const units = toNumber(c.unitsRemaining);
            return (
              <li key={c.id}>
                <CategoryRow
                  id={c.id}
                  name={c.name}
                  detail={
                    itemCount === 0
                      ? 'Nothing in stock'
                      : `${formatNumber(units)} ${pluralise(units, 'item')} across ${formatNumber(itemCount)} ${pluralise(itemCount, 'batch', 'batches')}`
                  }
                  deletable={itemCount === 0}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
