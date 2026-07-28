import { requireOwner } from '@/lib/auth';
import { getCategories } from '@/lib/queries';
import { PageHeader } from '@/components/ui/PageHeader';
import { ProductForm } from '@/components/forms/ProductForm';

export const metadata = { title: 'Add stock · Shop Books' };

export default async function NewProductPage() {
  await requireOwner();
  const categories = await getCategories();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Add stock"
        description="Record what you bought on a shopping day. The estimated profit updates as you type."
      />
      <div className="surface p-5">
        <ProductForm categories={categories} />
      </div>
    </div>
  );
}
