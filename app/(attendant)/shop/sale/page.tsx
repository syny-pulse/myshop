import { requireAttendant } from '@/lib/auth';
import { getSellableItems } from '@/lib/queries';
import { SaleForm } from '@/components/forms/SaleForm';

export const metadata = { title: 'Record a sale · Shop Books' };

export default async function AttendantSalePage() {
  await requireAttendant();

  // Same cost-free query the owner's sale form uses. See lib/queries.ts.
  const items = await getSellableItems();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[1.5rem] font-semibold tracking-tight">Record a sale</h1>
        <p className="mt-1 text-[0.9375rem] text-[var(--text-muted)]">
          Selling below the minimum is allowed. It is recorded so the owner can see it.
        </p>
      </div>

      <div className="surface p-5">
        <SaleForm items={items} />
      </div>
    </div>
  );
}
