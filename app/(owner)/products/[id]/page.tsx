import { notFound } from 'next/navigation';
import { requireOwner } from '@/lib/auth';
import { getCategories, getItemById } from '@/lib/queries';
import { PageHeader } from '@/components/ui/PageHeader';
import { ProductForm } from '@/components/forms/ProductForm';
import { Alert } from '@/components/ui/Alert';
import { formatNumber, pluralise } from '@/lib/format';

export const metadata = { title: 'Edit stock · Shop Books' };

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOwner();

  const { id } = await params;
  const itemId = Number(id);
  if (!Number.isInteger(itemId) || itemId <= 0) notFound();

  const [item, categories] = await Promise.all([getItemById(itemId), getCategories()]);
  if (!item) notFound();

  const unitsSold = item.quantity - item.qtyRemaining;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Edit stock" description={item.specifics} />

      {unitsSold > 0 && (
        <div className="mb-4">
          <Alert tone="info">
            {formatNumber(unitsSold)} {pluralise(unitsSold, 'unit has', 'units have')}{' '}
            already sold from this batch. Changing the cost price will not alter the
            profit already recorded on those sales.
          </Alert>
        </div>
      )}

      <div className="surface p-5">
        <ProductForm categories={categories} item={item} />
      </div>
    </div>
  );
}
